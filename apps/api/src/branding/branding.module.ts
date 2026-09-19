import { Body, Controller, Get, Inject, Injectable, Module, Put, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsHexColor, IsOptional, IsString } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { PrismaClient } from '@prisma/client';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';

export interface Branding {
  name: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  commissionRate: number;
}

class BrandingDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() favicon?: string;
  @IsOptional() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsHexColor() secondaryColor?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() commissionRate?: string;
}

const SETTING_PREFIX = 'brand.';

/**
 * Runtime white-label branding, per tenant. Each tenant Admin overrides
 * their own branding from their dashboard, stored in the `settings` table
 * keyed by `tenantId` (`null` = platform-level fallback, editable by the
 * Superadmin). `GET /branding` returns the merged result — the frontend
 * themes the entire app (name, logo, favicon, colors, currency) from this
 * one response.
 *
 * This service deliberately queries `Setting` through RAW_PRISMA with an
 * always-explicit `tenantId`, rather than the CLS-scoped PrismaService: the
 * scoped client runs UNSCOPED (every tenant's rows) whenever no tenant is
 * resolved for the current request, which is exactly the situation `GET
 * /branding` hits from an unauthenticated visitor on the bare platform
 * domain — that must resolve to the platform defaults (`tenantId: null`),
 * never an arbitrary tenant's branding.
 */
@Injectable()
export class BrandingService {
  constructor(
    private config: ConfigService,
    @Inject(RAW_PRISMA) private raw: PrismaClient,
  ) {}

  /**
   * `devTenantId` (local testing without real DNS) wins if present; else a
   * verified custom domain's host; else the platform (`null`). Note this
   * intentionally does NOT fall back to the ambient CLS tenant — callers
   * that already know their tenant (an authenticated admin editing their own
   * branding) pass it in directly instead.
   */
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

  /** Public so an authenticated caller (the admin/branding edit page) can fetch its own current tenant's branding directly, without going through host/dev-tenant guesswork. */
  async getForTenant(tenantId: number | null): Promise<Branding> {
    const defaults = this.config.get<Branding>('brand')!;
    const rows = await this.raw.setting.findMany({
      where: { tenantId, key: { startsWith: SETTING_PREFIX } },
    });

    const overrides: Record<string, string> = {};
    for (const r of rows) {
      if (r.key && r.value != null && r.value !== '') {
        overrides[r.key.slice(SETTING_PREFIX.length)] = r.value;
      }
    }

    const primaryColor = overrides.primaryColor || defaults.primaryColor || '#4f46e5';
    const secondaryColor = overrides.secondaryColor || defaults.secondaryColor || '#0ea5e9';

    return {
      name: overrides.name || defaults.name || 'EduCore',
      logo: overrides.logo || defaults.logo || '/brand/logo.svg',
      favicon: overrides.favicon || defaults.favicon || '/brand/favicon.ico',
      primaryColor,
      secondaryColor,
      currency: overrides.currency || defaults.currency || 'USD',
      commissionRate:
        overrides.commissionRate != null && overrides.commissionRate !== ''
          ? parseFloat(overrides.commissionRate)
          : defaults.commissionRate || 20,
    };
  }

  get(host?: string, devTenantId?: number): Promise<Branding> {
    return this.resolveTenantId(host, devTenantId).then((tenantId) => this.getForTenant(tenantId));
  }

  async update(tenantId: number | null, dto: BrandingDto): Promise<Branding> {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined && v !== '');
    for (const [key, value] of entries) {
      const settingKey = `${SETTING_PREFIX}${key}`;
      const existing = await this.raw.setting.findFirst({ where: { tenantId, key: settingKey } });
      if (existing) {
        await this.raw.setting.update({ where: { id: existing.id }, data: { value: String(value) } });
      } else {
        await this.raw.setting.create({ data: { tenantId, key: settingKey, value: String(value) } });
      }
    }
    return this.getForTenant(tenantId);
  }

  /** Restores a single field (or all) to the env default by removing overrides. */
  async reset(tenantId: number | null, field?: string): Promise<Branding> {
    await this.raw.setting.deleteMany({
      where: field ? { tenantId, key: `${SETTING_PREFIX}${field}` } : { tenantId, key: { startsWith: SETTING_PREFIX } },
    });
    return this.getForTenant(tenantId);
  }
}

@ApiTags('branding')
@Controller()
export class BrandingController {
  constructor(private branding: BrandingService) {}

  @Public()
  @Get('branding')
  get(@Query('host') host?: string, @Query('devTenant') devTenant?: string) {
    const devTenantId = devTenant ? Number(devTenant) : undefined;
    return this.branding.get(host, Number.isFinite(devTenantId as number) ? devTenantId : undefined);
  }

  // Self-service: any tenant Admin views/edits their own branding
  // (auto-scoped by the tenantId their JWT carries); the platform Superadmin
  // (tenantId null) views/edits the platform-level fallback the same way.
  @Roles(Principal.ADMIN)
  @Get('admin/branding')
  getMine(@CurrentUser('tenantId') tenantId: number | null) {
    return this.branding.getForTenant(tenantId ?? null);
  }

  @Roles(Principal.ADMIN)
  @Put('admin/branding')
  update(@CurrentUser('tenantId') tenantId: number | null, @Body() dto: BrandingDto) {
    return this.branding.update(tenantId ?? null, dto);
  }

  @Roles(Principal.ADMIN)
  @Put('admin/branding/reset')
  reset(@CurrentUser('tenantId') tenantId: number | null) {
    return this.branding.reset(tenantId ?? null);
  }
}

@Module({
  providers: [BrandingService],
  controllers: [BrandingController],
})
export class BrandingModule {}
