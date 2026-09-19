import {
  Body,
  Controller,
  Get,
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Post,
  Put,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

const SETTING_PREFIX = 'mail.';
const QUEUE_POLL_MS = 10_000;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;

/**
 * SMTP mailer with a DB-backed send queue (no Redis/BullMQ needed for a
 * platform this size). Runtime settings (stored in the `settings` table,
 * edited from Admin → Settings → Mail) override the .env boot defaults.
 * `send()` enqueues a job; a `setInterval` poller on this same process
 * delivers it in the background with retry + exponential-ish backoff.
 * Degrades gracefully to logging when no host is configured either way.
 */
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processQueue(), QUEUE_POLL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Effective mail config: DB overrides win over .env defaults. */
  async getConfig(): Promise<MailConfig> {
    const rows = await this.prisma.setting.findMany({ where: { key: { startsWith: SETTING_PREFIX } } });
    const overrides: Record<string, string> = {};
    for (const r of rows) {
      if (r.key && r.value != null && r.value !== '') overrides[r.key.slice(SETTING_PREFIX.length)] = r.value;
    }
    return {
      host: overrides.host ?? this.config.get<string>('mail.host') ?? '',
      port: overrides.port ? parseInt(overrides.port, 10) : this.config.get<number>('mail.port') ?? 587,
      user: overrides.user ?? this.config.get<string>('mail.user') ?? '',
      password: overrides.password ?? this.config.get<string>('mail.password') ?? '',
      from: overrides.from ?? this.config.get<string>('mail.from') ?? 'EduCore <no-reply@example.com>',
    };
  }

  async setConfig(dto: Partial<MailConfig>) {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    for (const [key, value] of entries) {
      const settingKey = `${SETTING_PREFIX}${key}`;
      if (value === '') {
        await this.prisma.setting.deleteMany({ where: { key: settingKey } });
        continue;
      }
      const existing = await this.prisma.setting.findFirst({ where: { key: settingKey } });
      if (existing) {
        await this.prisma.setting.update({ where: { id: existing.id }, data: { value: String(value) } });
      } else {
        await this.prisma.setting.create({ data: { key: settingKey, value: String(value) } });
      }
    }
    return this.getConfig();
  }

  private async transporter(): Promise<{ tx: nodemailer.Transporter; from: string } | null> {
    const cfg = await this.getConfig();
    if (!cfg.host) return null;
    return {
      tx: nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
      }),
      from: cfg.from,
    };
  }

  /** Actually delivers over SMTP. Throws if no host is configured or send fails. */
  private async deliver(to: string, subject: string, html: string) {
    const t = await this.transporter();
    if (!t) throw new Error('No mail host configured');
    await t.tx.sendMail({ from: t.from, to, subject, html });
  }

  /** Enqueues an email for background delivery — returns immediately. */
  async send(to: string, subject: string, html: string) {
    await this.prisma.mailQueueJob.create({ data: { to, subject, html } });
  }

  /** Sends immediately, bypassing the queue — used by the "send test email" admin action for instant feedback. */
  async sendNow(to: string, subject: string, html: string) {
    await this.deliver(to, subject, html);
  }

  /** Picks up due jobs (new, or previously failed past their backoff) and attempts delivery. */
  private async processQueue() {
    const cfg = await this.getConfig();
    if (!cfg.host) return; // nothing configured — leave jobs queued rather than burning attempts

    const jobs = await this.prisma.mailQueueJob.findMany({
      where: { status: 'pending', attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const job of jobs) {
      // Backoff: wait attempts^2 minutes since the last try before retrying.
      const backoffMs = job.attempts * job.attempts * 60_000;
      if (job.attempts > 0 && Date.now() - job.updatedAt.getTime() < backoffMs) continue;

      try {
        await this.deliver(job.to, job.subject, job.html);
        await this.prisma.mailQueueJob.update({ where: { id: job.id }, data: { status: 'sent' } });
      } catch (err) {
        const attempts = job.attempts + 1;
        await this.prisma.mailQueueJob.update({
          where: { id: job.id },
          data: {
            attempts,
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            lastError: (err as Error).message?.slice(0, 500),
          },
        });
        this.logger.warn(`Mail job ${job.id} to ${job.to} failed (attempt ${attempts}): ${(err as Error).message}`);
      }
    }
  }

  async queueStats() {
    const [pending, sent, failed, recent] = await Promise.all([
      this.prisma.mailQueueJob.count({ where: { status: 'pending' } }),
      this.prisma.mailQueueJob.count({ where: { status: 'sent' } }),
      this.prisma.mailQueueJob.count({ where: { status: 'failed' } }),
      this.prisma.mailQueueJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, to: true, subject: true, status: true, attempts: true, lastError: true, createdAt: true },
      }),
    ]);
    return { pending, sent, failed, recent };
  }

  instructorApproved(to: string, name: string, brand: string) {
    return this.send(
      to,
      `You're approved to teach on ${brand}!`,
      `<p>Hi ${name},</p><p>Great news — your instructor application on <b>${brand}</b> has been approved. You can now create and publish courses.</p><p>Happy teaching!</p>`,
    ).catch(() => {});
  }

  instructorRejected(to: string, name: string, brand: string) {
    return this.send(
      to,
      `Update on your ${brand} instructor application`,
      `<p>Hi ${name},</p><p>Thank you for your interest in teaching on <b>${brand}</b>. After review, we're unable to approve your application at this time.</p>`,
    ).catch(() => {});
  }
}

class MailConfigDto {
  @IsOptional() @IsString() host?: string;
  @IsOptional() @IsInt() port?: number;
  @IsOptional() @IsString() user?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() from?: string;
}

@ApiTags('mail-settings')
@Controller('admin/mail-settings')
@Roles(Principal.ADMIN)
@SuperAdmin()
export class MailSettingsController {
  constructor(private mail: MailService) {}

  @Get()
  async get() {
    const cfg = await this.mail.getConfig();
    // Never echo the real password back to the client — just whether one is set.
    return { ...cfg, password: cfg.password ? '••••••••' : '' };
  }

  @Put()
  update(@Body() dto: MailConfigDto) {
    return this.mail.setConfig(dto as Partial<MailConfig>);
  }

  @Post('test')
  async test(@CurrentUser('email') email: string) {
    await this.mail.sendNow(email, 'Test email from your platform', '<p>This is a test email — your SMTP configuration works.</p>');
    return { sent: true, to: email };
  }

  @Get('queue')
  queue() {
    return this.mail.queueStats();
  }
}

@Global()
@Module({
  providers: [MailService],
  controllers: [MailSettingsController],
  exports: [MailService],
})
export class MailModule {}
