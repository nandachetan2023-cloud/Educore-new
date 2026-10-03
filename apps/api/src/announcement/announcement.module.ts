import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  Put,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { PrismaClient } from '@prisma/client';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';

export const ANNOUNCEMENT_TONES = ['brand', 'info', 'success', 'warning'] as const;
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];

export interface Announcement {
  enabled: boolean;
  message: string;
  linkText: string;
  linkUrl: string;
  tone: AnnouncementTone;
}

class AnnouncementDto {
  @IsOptional() @IsString() enabled?: string;
  @IsOptional() @IsString() @MaxLength(200) message?: string;
  @IsOptional() @IsString() @MaxLength(60) linkText?: string;
  @IsOptional() @IsString() @MaxLength(300) linkUrl?: string;
  @IsOptional() @IsIn(ANNOUNCEMENT_TONES as unknown as string[]) tone?: AnnouncementTone;
}

const SETTING_PREFIX = 'announce.';

const DEFAULT_ANNOUNCEMENT: Announcement = {
  enabled: false,
  message: '',
  linkText: '',
  linkUrl: '',
  tone: 'brand',
};

/**
 * Site-wide promotional strip shown above the header on every page, edited by
 * an Admin from Admin → Site content without a redeploy. Stored per tenant in
 * the `settings` table under the `announce.` prefix and merged over defaults
 * by `GET /announcement`, which the storefront fetches unauthenticated.
 *
 * Like BrandingService this reads through RAW_PRISMA with an explicit
 * `tenantId`: the CLS-scoped client runs unscoped when no tenant is resolved,
 * which is exactly the case for an anonymous visitor on the platform domain —
 * that must fall back to the platform default rather than leak another
 * tenant's campaign.
 */
@Injectable()
export class AnnouncementService {
  constructor(
    private config: ConfigService,
    @Inject(RAW_PRISMA) private raw: PrismaClient,
  ) {}

  private async resolveTenantId(host?: string, devTenantId?: number): Promise<number | null> {
    if (devTenantId != null) return devTenantId;
    if (host) {
      const tenant = await this.raw.tenant.findFirst({
        where: { customDomain: host.toLowerCase(), domainStatus: 'verified' },
        select: { id: true },
      });
      if (tenant) return tenant.id;
    }
    return null;
  }

  async getForTenant(tenantId: number | null): Promise<Announcement> {
    const rows = await this.raw.setting.findMany({
      where: { tenantId, key: { startsWith: SETTING_PREFIX } },
    });
    const o: Record<string, string> = {};
    for (const r of rows) {
      if (r.key && r.value != null && r.value !== '') {
        o[r.key.slice(SETTING_PREFIX.length)] = r.value;
      }
    }

    const tone = o.tone as AnnouncementTone | undefined;
    return {
      enabled: o.enabled === 'true',
      message: o.message ?? DEFAULT_ANNOUNCEMENT.message,
      linkText: o.linkText ?? DEFAULT_ANNOUNCEMENT.linkText,
      linkUrl: o.linkUrl ?? DEFAULT_ANNOUNCEMENT.linkUrl,
      tone: tone && ANNOUNCEMENT_TONES.includes(tone) ? tone : DEFAULT_ANNOUNCEMENT.tone,
    };
  }

  get(host?: string, devTenantId?: number): Promise<Announcement> {
    return this.resolveTenantId(host, devTenantId).then((tenantId) => this.getForTenant(tenantId));
  }

  async update(tenantId: number | null, dto: AnnouncementDto): Promise<Announcement> {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    for (const [key, value] of entries) {
      const settingKey = `${SETTING_PREFIX}${key}`;
      // An empty string clears the override so the field falls back to default.
      if (value === '') {
        await this.raw.setting.deleteMany({ where: { tenantId, key: settingKey } });
        continue;
      }
      const existing = await this.raw.setting.findFirst({ where: { tenantId, key: settingKey } });
      if (existing) {
        await this.raw.setting.update({ where: { id: existing.id }, data: { value: String(value) } });
      } else {
        await this.raw.setting.create({ data: { tenantId, key: settingKey, value: String(value) } });
      }
    }
    return this.getForTenant(tenantId);
  }
}

@ApiTags('announcement')
@Controller()
export class AnnouncementController {
  constructor(private announcement: AnnouncementService) {}

  @Public()
  @Get('announcement')
  get(@Query('host') host?: string, @Query('devTenant') devTenant?: string) {
    const devTenantId = devTenant ? Number(devTenant) : undefined;
    return this.announcement.get(
      host,
      Number.isFinite(devTenantId as number) ? devTenantId : undefined,
    );
  }

  @Roles(Principal.ADMIN)
  @Get('admin/announcement')
  getMine(@CurrentUser('tenantId') tenantId: number | null) {
    return this.announcement.getForTenant(tenantId ?? null);
  }

  @Roles(Principal.ADMIN)
  @Put('admin/announcement')
  update(@CurrentUser('tenantId') tenantId: number | null, @Body() dto: AnnouncementDto) {
    return this.announcement.update(tenantId ?? null, dto);
  }
}

@Module({
  providers: [AnnouncementService],
  controllers: [AnnouncementController],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}