import { Body, Controller, Get, Inject, Injectable, Module, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsHexColor, IsNumber, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { PrismaClient } from '@prisma/client';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { CurrentUser, Public, Roles, SuperAdmin } from '../common/decorators';
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

/** One tier of the storefront's pricing table. */
export interface LandingPlan {
  name: string;
  tagline: string;
  price: number;
  currency: string;
  period: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight: boolean;
}

export const DEFAULT_LANDING_PLANS: LandingPlan[] = [
  {
    name: 'Starter',
    tagline: 'Dip your toes in the catalogue',
    price: 0,
    currency: 'INR',
    period: 'forever',
    features: ['Free preview lessons', 'Course catalogue browsing', 'Community discussions'],
    ctaLabel: 'Start learning',
    ctaHref: '/login?next=/courses',
    highlight: false,
  },
  {
    name: 'Pro',
    tagline: 'The full library, at your pace',
    price: 2999,
    currency: 'INR',
    period: 'per year',
    features: ['Every course, unlocked', 'Downloadable resources & projects', 'Certificates on completion', 'Priority Q&A with instructors'],
    ctaLabel: 'Go Pro',
    ctaHref: '/login?next=/courses',
    highlight: true,
  },
  {
    name: 'Team',
    tagline: 'Upskill a whole team',
    price: 9999,
    currency: 'INR',
    period: 'per year',
    features: ['Everything in Pro', 'Seats for your whole team', 'Team progress dashboard', 'Dedicated onboarding'],
    ctaLabel: 'Talk to us',
    ctaHref: '/login?next=/contact',
    highlight: false,
  },
];

const PLANS_SETTING_KEY = 'landing.plans';

class LandingPlanDto {
  @IsString() name!: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() period?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsString() ctaLabel?: string;
  @IsOptional() @IsString() ctaHref?: string;
  @IsOptional() @IsBoolean() highlight?: boolean;
}

class LandingPlansDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LandingPlanDto) plans!: LandingPlanDto[];
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
 * Legacy branding rows stored absolute upload URLs (e.g.
 * http://localhost:4000/uploads/...), which break on any deployed host —
 * the visitor's browser resolves localhost as their own machine. Uploads are
 * always served by this install, so any absolute URL under /uploads/ is
 * rewritten to the relative form the storefront proxies (next.config.mjs).
 * External image URLs (CDN etc.) are left untouched.
 */
export function normalizeAssetUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.pathname.startsWith('/uploads/')) return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    // Not absolute — already relative (or a non-http scheme), keep as-is.
  }
  return url;
}

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

  /** Public wrapper so the controller can resolve a tenant without exposing internals. */
  async resolveTenantIdPublic(host?: string, devTenantId?: number): Promise<number | null> {
    return this.resolveTenantId(host, devTenantId);
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
      logo: normalizeAssetUrl(overrides.logo || defaults.logo || '/brand/logo.svg'),
      favicon: normalizeAssetUrl(overrides.favicon || defaults.favicon || '/brand/favicon.ico'),
      primaryColor,
      secondaryColor,
      currency: overrides.currency || defaults.currency || 'INR',
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
      // Store asset URLs in the relative form (see normalizeAssetUrl) so a
      // value pasted/saved from an older install can never go absolute again.
      const stored = key === 'logo' || key === 'favicon' ? normalizeAssetUrl(String(value)) : String(value);
      const settingKey = `${SETTING_PREFIX}${key}`;
      const existing = await this.raw.setting.findFirst({ where: { tenantId, key: settingKey } });
      if (existing) {
        await this.raw.setting.update({ where: { id: existing.id }, data: { value: stored } });
      } else {
        await this.raw.setting.create({ data: { tenantId, key: settingKey, value: stored } });
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

  /**
   * Storefront pricing table. Tenant override first, then the platform-level
   * copy, then the built-in defaults — same fallback chain as the branding.
   */
  async getPlans(tenantId: number | null): Promise<LandingPlan[]> {
    const rows = await this.raw.setting.findMany({
      where: { key: PLANS_SETTING_KEY, OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { tenantId: 'desc' },
    });
    for (const row of rows) {
      if (!row.value) continue;
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.map((p: Partial<LandingPlan>) => ({
            name: String(p.name ?? 'Plan'),
            tagline: String(p.tagline ?? ''),
            price: Number(p.price ?? 0),
            currency: String(p.currency ?? 'INR'),
            period: String(p.period ?? ''),
            features: Array.isArray(p.features) ? p.features.map(String) : [],
            ctaLabel: String(p.ctaLabel ?? 'Get started'),
            ctaHref: String(p.ctaHref ?? '/courses'),
            highlight: Boolean(p.highlight),
          }));
        }
      } catch {
        // Malformed override — fall through to the next source.
      }
    }
    return DEFAULT_LANDING_PLANS;
  }

  async updatePlans(tenantId: number | null, plans: LandingPlanDto[]): Promise<LandingPlan[]> {
    const cleaned = plans.map((p) => ({
      name: p.name.trim(),
      tagline: p.tagline?.trim() ?? '',
      price: Number(p.price ?? 0),
      currency: p.currency ?? 'INR',
      period: p.period?.trim() ?? '',
      features: (p.features ?? []).map((f) => f.trim()).filter(Boolean),
      ctaLabel: p.ctaLabel?.trim() || 'Get started',
      ctaHref: p.ctaHref?.trim() || '/courses',
      highlight: Boolean(p.highlight),
    }));
    const value = JSON.stringify(cleaned);
    const existing = await this.raw.setting.findFirst({ where: { tenantId, key: PLANS_SETTING_KEY } });
    if (existing) {
      await this.raw.setting.update({ where: { id: existing.id }, data: { value } });
    } else {
      await this.raw.setting.create({ data: { tenantId, key: PLANS_SETTING_KEY, value } });
    }
    return this.getPlans(tenantId);
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

  // ── Storefront pricing table (landing page) ──────────────

  @Public()
  @Get('landing/plans')
  async plans(@Query('host') host?: string, @Query('devTenant') devTenant?: string) {
    const devTenantId = devTenant ? Number(devTenant) : undefined;
    const tenantId = await this.branding.resolveTenantIdPublic(
      host,
      Number.isFinite(devTenantId as number) ? devTenantId : undefined,
    );
    return this.branding.getPlans(tenantId);
  }

  @Roles(Principal.ADMIN)
  @Get('admin/landing/plans')
  myPlans(@CurrentUser('tenantId') tenantId: number | null) {
    return this.branding.getPlans(tenantId ?? null);
  }

  @Roles(Principal.ADMIN)
  @Put('admin/landing/plans')
  savePlans(@CurrentUser('tenantId') tenantId: number | null, @Body() dto: LandingPlansDto) {
    return this.branding.updatePlans(tenantId ?? null, dto.plans);
  }
}

/**
 * Lets the platform Superadmin view/edit any tenant admin's white-label
 * branding on their behalf (from tenant detail / admin-user pages),
 * mirroring SuperAdminDomainsController in domains.module.ts.
 */
@ApiTags('branding')
@Controller('admin/tenants/:tenantId/branding')
@Roles(Principal.ADMIN)
@SuperAdmin()
export class SuperAdminBrandingController {
  constructor(private branding: BrandingService) {}

  @Get()
  get(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.branding.getForTenant(tenantId);
  }

  @Put()
  update(@Param('tenantId', ParseIntPipe) tenantId: number, @Body() dto: BrandingDto) {
    return this.branding.update(tenantId, dto);
  }

  @Put('reset')
  reset(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.branding.reset(tenantId);
  }
}

@Module({
  providers: [BrandingService],
  controllers: [BrandingController, SuperAdminBrandingController],
})
export class BrandingModule {}
