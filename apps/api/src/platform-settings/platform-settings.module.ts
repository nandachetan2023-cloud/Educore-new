import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Inject,
  Module,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaClient } from '@prisma/client';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';
import { AuditService } from '../audit/audit.service';
import { RazorpayService } from '../payments/razorpay.service';
import { PaymentsModule } from '../payments/payments.module';

/** Keys editable from the Superadmin platform-settings screen. */
const PLATFORM_KEYS = ['supportEmail', 'currency', 'commissionRate', 'defaultLanguage'] as const;
type PlatformKey = (typeof PLATFORM_KEYS)[number];

const SETTING_PREFIX = 'platform.';

class PlatformSettingsDto {
  /** Empty string clears the override and falls back to the .env default. */
  @IsOptional() @IsString() supportEmail?: string;
  @IsOptional() @IsIn(['USD', 'EUR', 'GBP', 'INR', 'AED']) currency?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionRate?: number;
  @IsOptional() @IsIn(['en', 'ar', 'fr', 'es']) defaultLanguage?: string;
}

/** Shows enough to verify a secret is present without ever leaking it. */
function maskSecret(secret: string): string {
  if (!secret) return '';
  return `${secret.slice(0, 3)}••••${secret.slice(-3)}`;
}

@Injectable()
export class PlatformSettingsService {
  constructor(
    @Inject(RAW_PRISMA) private raw: PrismaClient,
    private config: ConfigService,
    private razorpay: RazorpayService,
    private audit: AuditService,
  ) {}

  /**
   * Environment & integration status for the Superadmin settings screen.
   * Secrets are masked — never returned in recoverable form.
   */
  async envOverview() {
    const stripeKey = this.config.get<string>('stripe.secretKey') ?? '';
    const stripeMode = stripeKey.includes('live') ? 'live' : stripeKey.includes('test') ? 'test' : '';
    const platformSecret = this.config.get<string>('stripe.platformWebhookSecret') ?? '';
    const paypalClient = this.config.get<string>('paypal.clientId') ?? '';
    const mailPass = this.config.get<string>('mail.password') ?? '';
    const s3Key = this.config.get<string>('storage.s3.accessKey') ?? '';
    const google = this.config.get<string>('oauth.google.clientId') ?? '';
    const github = this.config.get<string>('oauth.github.clientId') ?? '';
    const razorpayCfg = await this.razorpay.getConfig();

    return {
      app: {
        env: process.env.NODE_ENV ?? 'development',
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        apiPort: this.config.get<number>('port'),
        apiUrl: this.config.get<string>('apiUrl'),
        webUrl: this.config.get<string>('webUrl'),
      },
      payments: {
        courseCheckout: {
          stripe: { configured: !!stripeKey, mode: stripeMode, masked: maskSecret(stripeKey) },
          razorpay: { enabled: razorpayCfg.enabled, keyId: razorpayCfg.keyId },
          paypal: {
            configured: !!paypalClient,
            mode: this.config.get<string>('paypal.mode') ?? 'sandbox',
            masked: maskSecret(paypalClient),
          },
        },
        platformBillingWebhook: { configured: !!platformSecret, masked: maskSecret(platformSecret) },
      },
      mail: {
        configured: !!mailPass,
        host: this.config.get<string>('mail.host') ?? '',
        from: this.config.get<string>('mail.from') ?? '',
        port: this.config.get<number>('mail.port'),
      },
      storage: {
        driver: this.config.get<string>('storage.driver') ?? 'local',
        s3: { configured: !!s3Key, bucket: this.config.get<string>('storage.s3.bucket') ?? '' },
      },
      oauth: {
        callbackBase: this.config.get<string>('oauth.callbackBase'),
        google: { configured: !!google },
        github: { configured: !!github },
      },
    };
  }

  /** Effective platform-level defaults: DB overrides win over .env defaults. */
  async get() {
    const rows = await this.raw.setting.findMany({ where: { key: { startsWith: SETTING_PREFIX } } });
    const overrides = new Map<string, string>();
    for (const r of rows) {
      if (r.key && r.value != null && r.value !== '') {
        overrides.set(r.key.slice(SETTING_PREFIX.length), r.value);
      }
    }

    const value = (key: PlatformKey) => {
      const override = overrides.get(key);
      if (override !== undefined && override !== '') return override;
      switch (key) {
        case 'currency':
          return this.config.get<string>('brand.currency') ?? 'INR';
        case 'commissionRate':
          return String(this.config.get<number>('brand.commissionRate') ?? 20);
        case 'supportEmail':
        case 'defaultLanguage':
          return key === 'defaultLanguage' ? 'en' : '';
      }
    };

    const collect = (key: PlatformKey) => {
      const effective = String(value(key) ?? '');
      if (key === 'commissionRate') return Number(effective) || 0;
      return effective;
    };

    return {
      supportEmail: collect('supportEmail'),
      currency: collect('currency'),
      commissionRate: collect('commissionRate'),
      defaultLanguage: collect('defaultLanguage'),
      overridden: PLATFORM_KEYS.filter((k) => overrides.has(k) && overrides.get(k) !== ''),
    };
  }

  /**
   * Stores platform-level overrides (tenantId = null rows, `platform.*` keys).
   * Every change is audit-logged so the activity trail shows who tuned the
   * platform and to what values.
   */
  async update(dto: PlatformSettingsDto) {
    if (dto.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.supportEmail)) {
      throw new BadRequestException('supportEmail must be a valid email address');
    }
    if (dto.currency && !/^[A-Z]{3}$/.test(dto.currency)) {
      throw new BadRequestException('currency must be a 3-letter code, e.g. USD');
    }

    const changed: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(dto)) {
      if (raw === undefined) continue;
      const settingKey = `${SETTING_PREFIX}${key}`;
      if (raw === '') {
        await this.raw.setting.deleteMany({ where: { key: settingKey } });
        changed[key] = '(cleared — .env default applies)';
        continue;
      }
      const value = String(raw);
      const existing = await this.raw.setting.findFirst({ where: { key: settingKey } });
      if (existing) {
        await this.raw.setting.update({ where: { id: existing.id }, data: { value } });
      } else {
        await this.raw.setting.create({ data: { key: settingKey, value } });
      }
      changed[key] = key === 'commissionRate' ? Number(value) : value;
    }

    if (Object.keys(changed).length > 0) {
      await this.audit.log({ action: 'platform.settings', entity: 'setting', meta: changed });
    }
    return this.get();
  }
}

@ApiTags('platform')
@Controller('admin/platform')
@Roles(Principal.ADMIN)
@SuperAdmin()
export class PlatformSettingsController {
  constructor(private platform: PlatformSettingsService) {}

  @Get('env')
  env() {
    return this.platform.envOverview();
  }

  @Get('settings')
  settings() {
    return this.platform.get();
  }

  @Put('settings')
  async update(@Body() dto: PlatformSettingsDto) {
    return this.platform.update(dto);
  }
}

@Module({
  imports: [PaymentsModule],
  providers: [PlatformSettingsService],
  controllers: [PlatformSettingsController],
})
export class PlatformSettingsModule {}
