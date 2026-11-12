import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Injectable,
  Inject,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import slugify from 'slugify';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { CurrentUser, Public, Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';
import { AuditService } from '../audit/audit.service';
import {
  PricableCourse,
  PromoRule,
  appliesTo,
  eligibleSubtotal,
  priceCart,
  promoLabel,
  round2,
} from './discount';

type Target = 'all' | 'courses' | 'categories';
type Kind = 'percentage' | 'fixed';

const COUPON_SELECT = {
  id: true,
  code: true,
  description: true,
  type: true,
  value: true,
  minOrderAmount: true,
  maxDiscount: true,
  target: true,
  courseIds: true,
  categoryIds: true,
  usageLimit: true,
  perUserLimit: true,
  usedCount: true,
  startsAt: true,
  endsAt: true,
  status: true,
  approvalStatus: true,
  deactivateAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const OFFER_SELECT = {
  id: true,
  title: true,
  slug: true,
  subtitle: true,
  description: true,
  banner: true,
  badge: true,
  type: true,
  value: true,
  maxDiscount: true,
  target: true,
  courseIds: true,
  categoryIds: true,
  priority: true,
  usedCount: true,
  startsAt: true,
  endsAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

class CouponDto {
  @IsString() @MinLength(3) @MaxLength(32) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(['percentage', 'fixed']) type!: Kind;
  @IsNumber() @Min(0) value!: number;
  @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;
  @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;
  @IsIn(['all', 'courses', 'categories']) target!: Target;
  @IsOptional() @IsArray() @IsInt({ each: true }) @ArrayMaxSize(200) courseIds?: number[];
  @IsOptional() @IsArray() @IsInt({ each: true }) @ArrayMaxSize(50) categoryIds?: number[];
  @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsBoolean() status?: boolean;
  // DB-only: ignored (present in edit copies from frontend)
  @IsOptional() @IsNumber() id?: number;
  @IsOptional() @IsNumber() usedCount?: number;
  @IsOptional() @IsString() approvalStatus?: string;
  @IsOptional() @IsString() deactivateAt?: string;
  @IsOptional() @IsString() createdAt?: string;
  @IsOptional() @IsString() updatedAt?: string;
}

class UpdateCouponDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(32) code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(['percentage', 'fixed']) type?: Kind;
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;
  @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;
  @IsOptional() @IsIn(['all', 'courses', 'categories']) target?: Target;
  @IsOptional() @IsArray() @IsInt({ each: true }) @ArrayMaxSize(200) courseIds?: number[];
  @IsOptional() @IsArray() @IsInt({ each: true }) @ArrayMaxSize(50) categoryIds?: number[];
  @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsBoolean() status?: boolean;
  @IsOptional() @IsNumber() id?: number;
  @IsOptional() @IsNumber() usedCount?: number;
  @IsOptional() @IsString() approvalStatus?: string;
  @IsOptional() @IsString() deactivateAt?: string;
  @IsOptional() @IsString() createdAt?: string;
  @IsOptional() @IsString() updatedAt?: string;
}

class OfferDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(160) subtitle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() banner?: string;
  @IsOptional() @IsString() @MaxLength(24) badge?: string;
  @IsIn(['percentage', 'fixed']) type!: Kind;
  @IsNumber() @Min(0) value!: number;
  @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;
  @IsIn(['all', 'courses', 'categories']) target!: Target;
  @IsOptional() @IsArray() @IsInt({ each: true }) @ArrayMaxSize(200) courseIds?: number[];
  @IsOptional() @IsArray() @IsInt({ each: true }) @ArrayMaxSize(50) categoryIds?: number[];
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsBoolean() status?: boolean;
}

class UpdateOfferDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(160) subtitle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() banner?: string;
  @IsOptional() @IsString() @MaxLength(24) badge?: string;
  @IsOptional() @IsIn(['percentage', 'fixed']) type?: Kind;
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;
  @IsOptional() @IsIn(['all', 'courses', 'categories']) target?: Target;
  @IsOptional() @IsArray() @IsInt({ each: true }) @ArrayMaxSize(200) courseIds?: number[];
  @IsOptional() @IsArray() @IsInt({ each: true }) @ArrayMaxSize(50) categoryIds?: number[];
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsBoolean() status?: boolean;
}

class ValidateCouponDto {
  @IsString() @MinLength(3) @MaxLength(32) code!: string;
}

class DeactivateCouponDto {
  @IsDateString() at!: string;
}

@Injectable()
export class CouponsService {
  constructor(
    private prisma: PrismaService,
    @Inject(RAW_PRISMA) private raw: PrismaClient,
  ) {}

  // ── Admin: coupons ─────────────────────────────────────────────
  listCoupons(status?: string) {
    return this.prisma.coupon.findMany({
      where: status ? { status: status === 'active' } : {},
      select: {
        ...COUPON_SELECT,
        redemptions: { select: { id: true, amount: true, createdAt: true }, take: 5, orderBy: { createdAt: 'desc' } },
        _count: { select: { redemptions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCoupon(dto: CouponDto) {
    const code = normalizeCode(dto.code);
    await this.assertCodeFree(code);
    this.assertWindow(dto.startsAt, dto.endsAt);
    this.assertValues(dto.type, dto.value, dto.maxDiscount);

    return this.prisma.coupon.create({
      data: {
        code,
        description: dto.description?.trim() || null,
        type: dto.type,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount ?? null,
        maxDiscount: dto.maxDiscount ?? null,
        target: dto.target,
        courseIds: dto.courseIds ?? [],
        categoryIds: dto.categoryIds ?? [],
        usageLimit: dto.usageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? 1,
        startsAt: toDate(dto.startsAt),
        endsAt: toDate(dto.endsAt),
        status: dto.status ?? true,
        // Admin-created coupons are live by default; the Super Admin can
        // schedule a future deactivation instead of gating at creation.
        approvalStatus: 'approved',
      },
      select: COUPON_SELECT,
    });
  }

  /**
   * Super-Admin grant flow (spec §9): the platform owner creates a coupon and
   * grants it to ALL workspaces or ONE specific workspace. Written via
   * RAW_PRISMA with an explicit tenantId — the scoped client would otherwise
   * create a dead `tenantId = 0` row that no tenant's checkout can see.
   * Checkout isolation stays airtight: each workspace gets its own row, so a
   * code granted to workspace A simply doesn't exist in workspace B.
   */
  async createForTenants(dto: CouponDto, grant: { all?: boolean; tenantId?: number }) {
    const code = normalizeCode(dto.code);
    this.assertWindow(dto.startsAt, dto.endsAt);
    this.assertValues(dto.type, dto.value, dto.maxDiscount);

    const targets =
      grant.all
        ? await this.raw.tenant.findMany({ where: { status: { not: 'suspended' } }, select: { id: true } })
        : [{ id: grant.tenantId as number }];
    if (targets.length === 0) throw new BadRequestException('No target workspace');

    const base = {
      code,
      description: dto.description?.trim() || null,
      type: dto.type,
      value: dto.value,
      minOrderAmount: dto.minOrderAmount ?? null,
      maxDiscount: dto.maxDiscount ?? null,
      target: dto.target,
      courseIds: dto.courseIds ?? [],
      categoryIds: dto.categoryIds ?? [],
      usageLimit: dto.usageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? 1,
      startsAt: toDate(dto.startsAt),
      endsAt: toDate(dto.endsAt),
      status: dto.status ?? true,
    };

    const createdTenantIds: number[] = [];
    const skippedTenantIds: number[] = [];
    for (const t of targets) {
      const exists = await this.raw.coupon.findFirst({ where: { tenantId: t.id, code }, select: { id: true } });
      if (exists) {
        skippedTenantIds.push(t.id);
        continue;
      }
      await this.raw.coupon.create({ data: { ...base, tenantId: t.id } });
      createdTenantIds.push(t.id);
    }
    return { code, created: createdTenantIds.length, skipped: skippedTenantIds.length, createdTenantIds, skippedTenantIds };
  }

  async updateCoupon(id: number, dto: UpdateCouponDto) {    const current = await this.requireCoupon(id);
    if (dto.code && normalizeCode(dto.code) !== current.code) {
      await this.assertCodeFree(normalizeCode(dto.code));
    }
    this.assertWindow(dto.startsAt ?? iso(current.startsAt), dto.endsAt ?? iso(current.endsAt));
    this.assertValues(dto.type ?? current.type, dto.value ?? current.value, dto.maxDiscount ?? current.maxDiscount);

    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: normalizeCode(dto.code) } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.minOrderAmount !== undefined ? { minOrderAmount: dto.minOrderAmount } : {}),
        ...(dto.maxDiscount !== undefined ? { maxDiscount: dto.maxDiscount } : {}),
        ...(dto.target !== undefined ? { target: dto.target } : {}),
        ...(dto.courseIds !== undefined ? { courseIds: dto.courseIds } : {}),
        ...(dto.categoryIds !== undefined ? { categoryIds: dto.categoryIds } : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
        ...(dto.perUserLimit !== undefined ? { perUserLimit: dto.perUserLimit } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: toDate(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: toDate(dto.endsAt) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: COUPON_SELECT,
    });
  }

  async removeCoupon(id: number) {
    await this.requireCoupon(id);
    await this.prisma.coupon.delete({ where: { id } });
    return { removed: true };
  }

  /**
   * Super-Admin kill switch. `at` must be a future timestamp — the coupon
   * keeps working until then, then stops being redeemable. No past dates:
   * to stop one now, just toggle its status off.
   */
  async deactivateCoupon(id: number, at: string) {
    await this.requireCoupon(id);
    const when = new Date(at);
    if (Number.isNaN(when.getTime())) throw new BadRequestException('Provide a valid deactivation date and time');
    if (when.getTime() <= Date.now()) {
      throw new BadRequestException('Deactivation time must be in the future');
    }
    return this.prisma.coupon.update({ where: { id }, data: { deactivateAt: when }, select: COUPON_SELECT });
  }

  async reactivateCoupon(id: number) {
    await this.requireCoupon(id);
    return this.prisma.coupon.update({
      where: { id },
      data: { deactivateAt: null, status: true, approvalStatus: 'approved' },
      select: COUPON_SELECT,
    });
  }

  redemptions(couponId: number) {
    return this.prisma.couponRedemption.findMany({
      where: { couponId },
      select: {
        id: true,
        orderId: true,
        userId: true,
        amount: true,
        orderTotal: true,
        courseCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Sales snapshot for the coupons console header. */
  async summary() {
    const [coupons, offers, redemptions] = await Promise.all([
      this.prisma.coupon.count({ where: { status: true } }),
      this.prisma.offer.count({ where: { status: true, OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] } }),
      this.prisma.couponRedemption.aggregate({ _sum: { amount: true }, _count: true }),
    ]);
    const saved = round2(redemptions._sum.amount ?? 0);
    return {
      activeCoupons: coupons,
      activeOffers: offers,
      redemptions: redemptions._count,
      revenueSaved: saved,
      averageSaving: redemptions._count ? round2(saved / redemptions._count) : 0,
    };
  }

  /**
   * In-depth coupon analytics: totals, a 30-day timeline, per-coupon performance,
   * the users who redeemed (with their spend), the courses that sold, and the
   * most recent redemptions. Everything is computed from the redemption rows so
   * the numbers always match what was actually fulfilled.
   */
  async analytics(days = 30) {
    const windowDays = Math.min(365, Math.max(7, days));
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    since.setHours(0, 0, 0, 0);

    const [redemptions, coupons] = await Promise.all([
      this.prisma.couponRedemption.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          coupon: {
            select: {
              id: true, code: true, type: true, value: true, maxDiscount: true,
              status: true, usageLimit: true, perUserLimit: true, usedCount: true,
              startsAt: true, endsAt: true, deactivateAt: true,
            },
          },
        },
      }),
      this.prisma.coupon.findMany({
        select: {
          id: true, code: true, description: true, type: true, value: true, maxDiscount: true,
          target: true, status: true, usageLimit: true, perUserLimit: true, usedCount: true,
          startsAt: true, endsAt: true, deactivateAt: true, createdAt: true, tenantId: true,
        },
      }),
    ]);

    const userIds = [...new Set(redemptions.map((r) => r.userId))];
    const orderIds = [...new Set(redemptions.map((r) => r.orderId))];

    const [users, orders, orderItems, tenants] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, image: true, role: true },
          })
        : Promise.resolve([]),
      orderIds.length
        ? this.prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, invoiceId: true, totalAmount: true, paidAmount: true, currency: true, status: true, createdAt: true },
          })
        : Promise.resolve([]),
      orderIds.length
        ? this.prisma.orderItem.findMany({
            where: { orderId: { in: orderIds } },
            select: { orderId: true, courseId: true, price: true },
          })
        : Promise.resolve([]),
      this.prisma.tenant.findMany({ select: { id: true, name: true, slug: true } }).catch(() => []),
    ]);

    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    const courseIds = [...new Set(orderItems.map((i) => i.courseId))];
    const courses = courseIds.length
      ? await this.prisma.course.findMany({
          where: { id: { in: courseIds } },
          select: { id: true, title: true, slug: true, thumbnail: true },
        })
      : [];

    const userById = new Map(users.map((u) => [u.id, u]));
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const itemsByOrder = new Map<number, { courseId: number; price: number }[]>();
    for (const i of orderItems) {
      const list = itemsByOrder.get(i.orderId) ?? [];
      list.push({ courseId: i.courseId, price: i.price });
      itemsByOrder.set(i.orderId, list);
    }

    // ── Totals ────────────────────────────────────────────────
    const totalDiscount = round2(redemptions.reduce((n, r) => n + r.amount, 0));
    const totalRevenue = round2(redemptions.reduce((n, r) => n + r.orderTotal, 0));
    const totalCourses = redemptions.reduce((n, r) => n + r.courseCount, 0);
    const uniqueUsers = new Set(redemptions.map((r) => r.userId)).size;
    const inWindow = redemptions.filter((r) => r.createdAt >= since);

    // ── 30-day timeline ───────────────────────────────────────
    const timeline: { date: string; redemptions: number; discount: number; revenue: number; users: number }[] = [];
    const byDay = new Map<string, { redemptions: number; discount: number; revenue: number; users: Set<number> }>();
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      byDay.set(d.toISOString().slice(0, 10), { redemptions: 0, discount: 0, revenue: 0, users: new Set() });
    }
    for (const r of inWindow) {
      const key = r.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      bucket.redemptions += 1;
      bucket.discount += r.amount;
      bucket.revenue += r.orderTotal;
      bucket.users.add(r.userId);
    }
    for (const [date, b] of byDay) {
      timeline.push({
        date,
        redemptions: b.redemptions,
        discount: round2(b.discount),
        revenue: round2(b.revenue),
        users: b.users.size,
      });
    }

    // ── Per-coupon performance ────────────────────────────────
    const perCoupon = new Map<number, {
      coupon: (typeof coupons)[number];
      redemptions: number;
      users: Set<number>;
      discount: number;
      revenue: number;
      firstUsedAt: Date | null;
      lastUsedAt: Date | null;
    }>();
    for (const c of coupons) {
      perCoupon.set(c.id, { coupon: c, redemptions: 0, users: new Set(), discount: 0, revenue: 0, firstUsedAt: null, lastUsedAt: null });
    }
    for (const r of redemptions) {
      const entry = perCoupon.get(r.couponId);
      if (!entry) continue;
      entry.redemptions += 1;
      entry.users.add(r.userId);
      entry.discount += r.amount;
      entry.revenue += r.orderTotal;
      if (!entry.firstUsedAt || r.createdAt < entry.firstUsedAt) entry.firstUsedAt = r.createdAt;
      if (!entry.lastUsedAt || r.createdAt > entry.lastUsedAt) entry.lastUsedAt = r.createdAt;
    }
    const now = Date.now();
    const couponPerformance = [...perCoupon.values()]
      .map(({ coupon: c, redemptions, users, discount, revenue, firstUsedAt, lastUsedAt }) => {
        const scheduled = c.startsAt ? c.startsAt.getTime() > now : false;
        const expired = c.endsAt ? c.endsAt.getTime() < now : false;
        const deactivated = c.deactivateAt ? c.deactivateAt.getTime() < now : false;
        const state = !c.status || deactivated
          ? 'disabled'
          : scheduled
            ? 'scheduled'
            : expired
              ? 'expired'
              : 'active';
        return {
          id: c.id,
          code: c.code,
          description: c.description,
          type: c.type,
          value: c.value,
          maxDiscount: c.maxDiscount,
          target: c.target,
          state,
          tenantId: c.tenantId,
          tenantName: tenantById.get(c.tenantId)?.name ?? null,
          redemptions,
          uniqueUsers: users.size,
          discountGiven: round2(discount),
          revenueGenerated: round2(revenue),
          avgOrderValue: redemptions ? round2(revenue / redemptions) : 0,
          avgDiscount: redemptions ? round2(discount / redemptions) : 0,
          usageLimit: c.usageLimit,
          perUserLimit: c.perUserLimit,
          usedCount: c.usedCount,
          utilizationPct: c.usageLimit ? Math.min(100, Math.round((redemptions / c.usageLimit) * 100)) : null,
          firstUsedAt,
          lastUsedAt,
        };
      })
      .sort((a, b) => b.redemptions - a.redemptions || b.discountGiven - a.discountGiven);

    // ── Users who redeemed ────────────────────────────────────
    const perUser = new Map<number, {
      userId: number;
      redemptions: number;
      discount: number;
      spend: number;
      coupons: Map<number, { code: string; uses: number; discount: number }>;
      firstUsedAt: Date | null;
      lastUsedAt: Date | null;
    }>();
    for (const r of redemptions) {
      const entry = perUser.get(r.userId) ?? {
        userId: r.userId, redemptions: 0, discount: 0, spend: 0,
        coupons: new Map(), firstUsedAt: null, lastUsedAt: null,
      };
      entry.redemptions += 1;
      entry.discount += r.amount;
      entry.spend += r.orderTotal;
      const c = entry.coupons.get(r.couponId) ?? { code: r.coupon.code, uses: 0, discount: 0 };
      c.uses += 1;
      c.discount += r.amount;
      entry.coupons.set(r.couponId, c);
      if (!entry.firstUsedAt || r.createdAt < entry.firstUsedAt) entry.firstUsedAt = r.createdAt;
      if (!entry.lastUsedAt || r.createdAt > entry.lastUsedAt) entry.lastUsedAt = r.createdAt;
      perUser.set(r.userId, entry);
    }
    const topUsers = [...perUser.values()]
      .map((u) => {
        const profile = userById.get(u.userId);
        return {
          userId: u.userId,
          name: profile?.name ?? 'Unknown user',
          email: profile?.email ?? '',
          image: profile?.image ?? null,
          role: profile?.role ?? 'student',
          redemptions: u.redemptions,
          totalDiscount: round2(u.discount),
          totalSpend: round2(u.spend),
          avgDiscount: u.redemptions ? round2(u.discount / u.redemptions) : 0,
          coupons: [...u.coupons.values()].map((c) => ({ code: c.code, uses: c.uses, discount: round2(c.discount) })),
          firstUsedAt: u.firstUsedAt,
          lastUsedAt: u.lastUsedAt,
        };
      })
      .sort((a, b) => b.totalDiscount - a.totalDiscount || b.redemptions - a.redemptions);

    // ── Courses that sold with a coupon ───────────────────────
    const perCourse = new Map<number, { redemptions: number; discount: number; revenue: number }>();
    for (const r of redemptions) {
      for (const item of itemsByOrder.get(r.orderId) ?? []) {
        const entry = perCourse.get(item.courseId) ?? { redemptions: 0, discount: 0, revenue: 0 };
        entry.redemptions += 1;
        entry.discount += r.amount / Math.max(1, (itemsByOrder.get(r.orderId) ?? []).length);
        entry.revenue += item.price;
        perCourse.set(item.courseId, entry);
      }
    }
    const topCourses = [...perCourse.entries()]
      .map(([courseId, v]) => ({
        courseId,
        title: courseById.get(courseId)?.title ?? 'Course',
        slug: courseById.get(courseId)?.slug ?? '',
        thumbnail: courseById.get(courseId)?.thumbnail ?? null,
        redemptions: v.redemptions,
        discount: round2(v.discount),
        revenue: round2(v.revenue),
      }))
      .sort((a, b) => b.redemptions - a.redemptions || b.revenue - a.revenue)
      .slice(0, 10);

    // ── Recent redemptions (user + order detail) ──────────────
    const recentRedemptions = redemptions.slice(0, 50).map((r) => {
      const profile = userById.get(r.userId);
      const order = orderById.get(r.orderId);
      const items = itemsByOrder.get(r.orderId) ?? [];
      return {
        id: r.id,
        couponId: r.couponId,
        couponCode: r.coupon.code,
        couponType: r.coupon.type,
        couponValue: r.coupon.value,
        tenantId: r.tenantId,
        tenantName: tenantById.get(r.tenantId)?.name ?? null,
        userId: r.userId,
        userName: profile?.name ?? 'Unknown user',
        userEmail: profile?.email ?? '',
        userImage: profile?.image ?? null,
        orderId: r.orderId,
        invoiceId: order?.invoiceId ?? null,
        orderStatus: order?.status ?? null,
        currency: order?.currency ?? 'INR',
        discount: round2(r.amount),
        orderTotal: round2(r.orderTotal),
        courseCount: r.courseCount,
        courses: items.map((i) => ({ id: i.courseId, title: courseById.get(i.courseId)?.title ?? 'Course' })),
        createdAt: r.createdAt,
      };
    });

    const windowRevenue = round2(inWindow.reduce((n, r) => n + r.orderTotal, 0));
    const windowDiscount = round2(inWindow.reduce((n, r) => n + r.amount, 0));

    // ── Per-workspace breakdown (platform-wide for super admins) ──
    const perTenant = new Map<number, { tenantId: number; name: string | null; slug: string | null; redemptions: number; users: Set<number>; discount: number; revenue: number; coupons: Set<number> }>();
    for (const r of redemptions) {
      const tenant = tenantById.get(r.tenantId);
      const entry = perTenant.get(r.tenantId) ?? {
        tenantId: r.tenantId,
        name: tenant?.name ?? null,
        slug: tenant?.slug ?? null,
        redemptions: 0,
        users: new Set<number>(),
        discount: 0,
        revenue: 0,
        coupons: new Set<number>(),
      };
      entry.redemptions += 1;
      entry.users.add(r.userId);
      entry.discount += r.amount;
      entry.revenue += r.orderTotal;
      entry.coupons.add(r.couponId);
      perTenant.set(r.tenantId, entry);
    }
    const byTenant = [...perTenant.values()]
      .map((t) => ({
        tenantId: t.tenantId,
        name: t.name,
        slug: t.slug,
        redemptions: t.redemptions,
        uniqueUsers: t.users.size,
        couponsUsed: t.coupons.size,
        discountGiven: round2(t.discount),
        revenueGenerated: round2(t.revenue),
      }))
      .sort((a, b) => b.redemptions - a.redemptions || b.discountGiven - a.discountGiven);

    return {
      windowDays,
      totals: {
        redemptions: redemptions.length,
        uniqueUsers,
        couponsUsed: new Set(redemptions.map((r) => r.couponId)).size,
        totalCoupons: coupons.length,
        activeCoupons: coupons.filter((c) => c.status && (!c.endsAt || c.endsAt.getTime() >= now) && (!c.startsAt || c.startsAt.getTime() <= now)).length,
        discountGiven: totalDiscount,
        revenueWithCoupons: totalRevenue,
        coursesSold: totalCourses,
        avgOrderValue: redemptions.length ? round2(totalRevenue / redemptions.length) : 0,
        avgDiscount: redemptions.length ? round2(totalDiscount / redemptions.length) : 0,
        avgCoursesPerOrder: redemptions.length ? round2(totalCourses / redemptions.length) : 0,
        discountRatePct: totalRevenue > 0 ? Math.round((totalDiscount / totalRevenue) * 1000) / 10 : 0,
        windowRedemptions: inWindow.length,
        windowRevenue,
        windowDiscount,
        windowUniqueUsers: new Set(inWindow.map((r) => r.userId)).size,
      },
      timeline,
      coupons: couponPerformance,
      byTenant,
      topUsers,
      topCourses,
      recentRedemptions,
    };
  }

  // ── Admin: offers ──────────────────────────────────────────────
  listOffers(status?: string) {
    return this.prisma.offer.findMany({
      where: status ? { status: status === 'active' } : {},
      select: OFFER_SELECT,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createOffer(dto: OfferDto) {
    this.assertWindow(dto.startsAt, dto.endsAt);
    this.assertValues(dto.type, dto.value, dto.maxDiscount);

    const slug = await this.uniqueOfferSlug(dto.title);
    return this.prisma.offer.create({
      data: {
        title: dto.title.trim(),
        slug,
        subtitle: dto.subtitle?.trim() || null,
        description: dto.description?.trim() || null,
        banner: dto.banner?.trim() || null,
        badge: dto.badge?.trim() || null,
        type: dto.type,
        value: dto.value,
        maxDiscount: dto.maxDiscount ?? null,
        target: dto.target,
        courseIds: dto.courseIds ?? [],
        categoryIds: dto.categoryIds ?? [],
        priority: dto.priority ?? 0,
        startsAt: toDate(dto.startsAt),
        endsAt: toDate(dto.endsAt),
        status: dto.status ?? true,
      },
      select: OFFER_SELECT,
    });
  }

  async updateOffer(id: number, dto: UpdateOfferDto) {
    const current = await this.requireOffer(id);
    this.assertWindow(dto.startsAt ?? iso(current.startsAt), dto.endsAt ?? iso(current.endsAt));
    this.assertValues(dto.type ?? current.type, dto.value ?? current.value, dto.maxDiscount ?? current.maxDiscount);

    return this.prisma.offer.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle.trim() || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.banner !== undefined ? { banner: dto.banner.trim() || null } : {}),
        ...(dto.badge !== undefined ? { badge: dto.badge.trim() || null } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.maxDiscount !== undefined ? { maxDiscount: dto.maxDiscount } : {}),
        ...(dto.target !== undefined ? { target: dto.target } : {}),
        ...(dto.courseIds !== undefined ? { courseIds: dto.courseIds } : {}),
        ...(dto.categoryIds !== undefined ? { categoryIds: dto.categoryIds } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: toDate(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: toDate(dto.endsAt) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: OFFER_SELECT,
    });
  }

  async removeOffer(id: number) {
    await this.requireOffer(id);
    await this.prisma.offer.delete({ where: { id } });
    return { removed: true };
  }

  // ── Public storefront ──────────────────────────────────────────
  /** Live and already-started offers, richest discount first. */
  async storefrontOffers(courseId?: number) {
    const now = new Date();
    const offers = await this.prisma.offer.findMany({
      where: {
        status: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      select: OFFER_SELECT,
      orderBy: [{ priority: 'desc' }, { value: 'desc' }],
    });
    if (!offers.length) return [];

    const live = { status: 'active' as const, isApproved: 'approved' as const };
    const scopedIds = [...new Set(offers.flatMap((o) => o.courseIds))];
    // Course-scoped offers only need their own courses; category/all-scoped ones
    // have to look at the catalog to know what they currently cover.
    const where = courseId
      ? { id: courseId, ...live }
      : offers.every((o) => o.target === 'courses')
        ? { id: { in: scopedIds.length ? scopedIds : [-1] }, ...live }
        : live;

    const courses = await this.prisma.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnail: true,
        price: true,
        discount: true,
        categoryId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    return offers
      .map((offer) => {
        const rule = toRule(offer);
        const eligible = courses.filter((c) => appliesTo(rule, { id: c.id, categoryId: c.categoryId }));
        return {
          ...offer,
          valueLabel: discountTypeLabel(offer.type, offer.value),
          courseCount: eligible.length,
          courses: eligible.slice(0, 4).map(({ categoryId, ...course }) => course),
        };
      })
      .filter((offer) => (courseId ? offer.courseCount > 0 : true));
  }

  // ── Pricing ────────────────────────────────────────────────────
  /**
   * Prices a user's cart with an optional coupon code plus whatever offers are
   * running. Returns the winning promotion so checkout can stamp it on the
   * order. `couponCode` that can't be honored throws — a silent no-op would let
   * a shopper think they got a deal.
   */
  async priceCartForUser(userId: number, couponCode?: string | null) {
    const items = await this.prisma.cart.findMany({
      where: { userId },
      select: {
        course: { select: { id: true, title: true, price: true, discount: true, categoryId: true } },
      },
    });

    const courses: PricableCourse[] = items.map((i) => ({
      id: i.course.id,
      categoryId: i.course.categoryId,
      base: Math.max(0, (i.course.price ?? 0) - (i.course.discount ?? 0)),
    }));
    const titles = new Map(items.map((i) => [i.course.id, i.course.title]));
    const subtotal = round2(courses.reduce((s, c) => s + c.base, 0));

    const offerRule = await this.bestOfferRule(courses);
    const couponRule = couponCode ? await this.resolveCoupon(couponCode, userId, subtotal) : null;

    // A code that covers nothing in the cart is an error, not a silent no-op.
    if (couponRule && priceCart(courses, [couponRule]).discountTotal <= 0) {
      throw new BadRequestException(`${couponRule.code} does not apply to the courses in your cart`);
    }

    const priced = priceCart(courses, [couponRule, offerRule]);
    return {
      priced,
      titles,
      courses,
      couponCode: priced.promo?.kind === 'coupon' ? (priced.promo.code ?? null) : null,
      couponId: priced.promo?.kind === 'coupon' ? (priced.promo.id ?? null) : null,
      coupon: priced.promo?.kind === 'coupon' ? describe(priced.promo) : null,
      offer: priced.promo?.kind === 'offer' ? describe(priced.promo) : null,
      offerId: priced.promo?.kind === 'offer' ? (priced.promo.id ?? null) : null,
      offerTitle: priced.promo?.kind === 'offer' ? priced.promo.title : null,
      discountTotal: priced.discountTotal,
      total: priced.total,
      subtotal: priced.subtotal,
    };
  }

  /** Coupon preview for the cart page — same math checkout will run. */
  async preview(userId: number, code: string) {
    const pricedCart = await this.priceCartForUser(userId, code);
    if (!pricedCart.priced.promo || pricedCart.discountTotal <= 0) {
      throw new BadRequestException(`${normalizeCode(code)} does not apply to the courses in your cart`);
    }
    return {
      valid: true,
      ...describe(pricedCart.priced.promo!),
      subtotal: pricedCart.subtotal,
      discount: pricedCart.discountTotal,
      total: pricedCart.total,
    };
  }

  /** Records the usage of a coupon/offer once an order is actually paid. */
  async recordRedemption(order: {
    id: number;
    buyerId: number;
    totalAmount: number;
    couponCode?: string | null;
    offerId?: number | null;
    discount: number;
    courseCount: number;
  }) {
    if (order.couponCode && order.discount > 0) {
      const coupon = await this.prisma.coupon.findFirst({ where: { code: order.couponCode } });
      if (coupon) {
        await this.prisma.$transaction([
          this.prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } }),
          this.prisma.couponRedemption.upsert({
            where: { orderId: order.id },
            create: {
              couponId: coupon.id,
              orderId: order.id,
              userId: order.buyerId,
              amount: order.discount,
              orderTotal: order.totalAmount,
              courseCount: order.courseCount,
            },
            update: {},
          }),
        ]);
      }
    }

    if (order.offerId && order.discount > 0) {
      await this.prisma.offer
        .update({ where: { id: order.offerId }, data: { usedCount: { increment: 1 } } })
        .catch(() => undefined);
    }
  }

  // ── Internals ──────────────────────────────────────────────────
  private async requireCoupon(id: number) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id }, select: COUPON_SELECT });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  private async requireOffer(id: number) {
    const offer = await this.prisma.offer.findFirst({ where: { id }, select: OFFER_SELECT });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  private async assertCodeFree(code: string) {
    const existing = await this.prisma.coupon.findFirst({ where: { code }, select: { id: true } });
    if (existing) throw new ConflictException(`Coupon code ${code} already exists`);
  }

  private async uniqueOfferSlug(title: string) {
    const base = slugify(title, { lower: true, strict: true }) || 'offer';
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const clash = await this.prisma.offer.findFirst({ where: { slug }, select: { id: true } });
      if (!clash) return slug;
      slug = `${base}-${i}`;
    }
    return `${base}-${Date.now()}`;
  }

  private assertWindow(startsAt?: string | null, endsAt?: string | null) {
    if (!startsAt || !endsAt) return;
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new BadRequestException('The end date must be after the start date');
    }
  }

  private assertValues(type: Kind, value: number, maxDiscount?: number | null) {
    if (type === 'percentage' && value > 100) {
      throw new BadRequestException('A percentage discount cannot exceed 100');
    }
    if (maxDiscount != null && maxDiscount <= 0) {
      throw new BadRequestException('The maximum discount must be greater than zero');
    }
  }

  /** Full eligibility gate for an entered code. */
  private async resolveCoupon(code: string, userId: number, subtotal: number): Promise<PromoRule> {
    const normalized = normalizeCode(code);
    const coupon = await this.prisma.coupon.findFirst({ where: { code: normalized } });
    if (!coupon) throw new BadRequestException('That coupon code does not exist');

    const now = new Date();
    if (coupon.deactivateAt && coupon.deactivateAt <= now) {
      throw new BadRequestException('That coupon has been deactivated');
    }
    if (!coupon.status) throw new BadRequestException('That coupon is no longer active');
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException(`That coupon is not active until ${coupon.startsAt.toISOString().slice(0, 10)}`);
    }
    if (coupon.endsAt && coupon.endsAt <= now) throw new BadRequestException('That coupon has expired');
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('That coupon has reached its usage limit');
    }
    if (coupon.minOrderAmount != null && subtotal < coupon.minOrderAmount) {
      throw new BadRequestException(
        `That coupon needs a minimum order of ${coupon.minOrderAmount.toFixed(2)}`,
      );
    }
    if (coupon.perUserLimit > 0) {
      const used = await this.prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } });
      if (used >= coupon.perUserLimit) {
        throw new BadRequestException('You have already used that coupon');
      }
    }

    return toRule(coupon);
  }

  /** Highest-value running offer that covers anything in the cart. */
  private async bestOfferRule(courses: PricableCourse[]): Promise<PromoRule | null> {
    const now = new Date();
    const offers = await this.prisma.offer.findMany({
      where: {
        status: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      select: OFFER_SELECT,
      orderBy: [{ priority: 'desc' }, { value: 'desc' }],
      take: 25,
    });

    let best: PromoRule | null = null;
    let bestValue = 0;
    for (const offer of offers) {
      const rule = toRule(offer);
      if (eligibleSubtotal(rule, courses) <= 0) continue;
      if (rule.value > bestValue) {
        bestValue = rule.value;
        best = rule;
      }
    }
    return best;
  }
}

/** Coupon/offer row -> the rule shape the math engine understands. */
function toRule(row: {
  id: number;
  code?: string | null;
  title?: string;
  type: Kind;
  value: number;
  maxDiscount?: number | null;
  target: Target;
  courseIds: number[];
  categoryIds: number[];
}): PromoRule {
  return {
    kind: row.code ? 'coupon' : 'offer',
    id: row.id,
    code: row.code ?? null,
    title: row.title ?? (row.code as string),
    type: row.type,
    value: row.value,
    maxDiscount: row.maxDiscount ?? null,
    target: row.target,
    courseIds: row.courseIds ?? [],
    categoryIds: row.categoryIds ?? [],
  };
}

function describe(promo: PromoRule) {
  return {
    kind: promo.kind,
    code: promo.code ?? null,
    title: promo.title,
    type: promo.type,
    value: promo.value,
    valueLabel: discountTypeLabel(promo.type, promo.value),
    maxDiscount: promo.maxDiscount ?? null,
    label: promoLabel(promo),
    target: promo.target,
  };
}

function discountTypeLabel(type: Kind, value: number): string {
  return type === 'percentage' ? `${value}% off` : `${value} off`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function toDate(value?: string | null): Date | null {
  return value ? new Date(value) : null;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private coupons: CouponsService, private audit: AuditService) {}

  /** Live offers for the storefront banner/carousel. */
  @Public()
  @Get('offers')
  offers(@Query('courseId') courseId?: string) {
    const id = Number(courseId);
    return this.coupons.storefrontOffers(courseId && Number.isFinite(id) ? id : undefined);
  }

  /** Check a code against the current cart without buying anything. */
  @Roles(Principal.STUDENT, Principal.INSTRUCTOR)
  @Post('validate')
  async validate(@CurrentUser('sub') userId: number, @Body() dto: ValidateCouponDto) {
    try {
      return await this.coupons.preview(userId, dto.code);
    } catch (e) {
      // Blocked/rejected coupon attempt — audit trail for the Super Admin.
      await this.audit.log({
        action: 'coupon.blocked',
        entity: 'coupon',
        actorType: 'user',
        actorId: userId,
        meta: { code: dto.code, reason: e instanceof Error ? e.message : 'unknown' },
      });
      throw e;
    }
  }
}

@ApiTags('admin coupons')
@Controller('admin/coupons')
@Roles(Principal.ADMIN)
export class AdminCouponsController {
  constructor(private coupons: CouponsService, private audit: AuditService) {}

  @Get('summary')
  summary() {
    return this.coupons.summary();
  }

  @Get('analytics')
  analytics(@Query('days') days?: string) {
    return this.coupons.analytics(days ? parseInt(days, 10) : 30);
  }

  @Get()
  list(@Query('status') status?: string) {
    return this.coupons.listCoupons(status);
  }

  @Get(':id/redemptions')
  redemptions(@Param('id', ParseIntPipe) id: number) {
    return this.coupons.redemptions(id);
  }

  @Post()
  async create(@Body() dto: CouponDto) {
    const coupon = await this.coupons.createCoupon(dto);
    await this.audit.log({ action: 'coupon.create', entity: 'coupon', entityId: coupon.id, meta: { code: coupon.code, type: coupon.type, value: coupon.value } });
    return coupon;
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCouponDto) {
    return this.coupons.updateCoupon(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coupons.removeCoupon(id);
  }
}

@ApiTags('admin offers')
@Controller('admin/offers')
@Roles(Principal.ADMIN)
export class AdminOffersController {
  constructor(private coupons: CouponsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.coupons.listOffers(status);
  }

  @Post()
  create(@Body() dto: OfferDto) {
    return this.coupons.createOffer(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOfferDto) {
    return this.coupons.updateOffer(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coupons.removeOffer(id);
  }
}

/**
 * Platform-level coupon grants (spec §9). ONLY the Super Admin creates
 * coupons; `grant: 'all'` fans the code out to every active workspace,
 * `grant: 'tenant'` grants it to exactly one — every other workspace can
 * never see or redeem it (each row is tenant-scoped).
 */
@ApiTags('platform coupons')
@Controller('admin/platform/coupons')
@SuperAdmin()
export class PlatformCouponsController {
  constructor(private coupons: CouponsService, private audit: AuditService) {}

  @Post()
  async grant(@Body() body: CouponDto & { grant?: 'all' | 'tenant'; tenantId?: number }) {
    if (body.grant === 'tenant' && !body.tenantId) throw new BadRequestException('Pick a workspace to grant this coupon to');
    const result = await this.coupons.createForTenants(body, { all: body.grant !== 'tenant', tenantId: body.tenantId });
    await this.audit.log({
      action: 'coupon.grant',
      entity: 'coupon',
      meta: { code: result.code, grant: body.grant ?? 'all', created: result.created, skipped: result.skipped },
    });
    return result;
  }
}

/**
 * Super-Admin scheduled deactivation / reactivation only.
 * Admins can CRUD coupons; Super Admin can only schedule a future kill switch
 * and reactivate.
 */
@ApiTags('superadmin coupons')
@Controller('superadmin/coupons')
@SuperAdmin()
export class SuperAdminCouponsController {
  constructor(private coupons: CouponsService, private audit: AuditService) {}

  @Patch(':id/deactivate')
  async deactivate(@Param('id', ParseIntPipe) id: number, @Body() dto: DeactivateCouponDto) {
    const coupon = await this.coupons.deactivateCoupon(id, dto.at);
    await this.audit.log({ action: 'coupon.schedule_deactivate', entity: 'coupon', entityId: id, meta: { at: dto.at } });
    return coupon;
  }

  @Patch(':id/reactivate')
  async reactivate(@Param('id', ParseIntPipe) id: number) {
    const coupon = await this.coupons.reactivateCoupon(id);
    await this.audit.log({ action: 'coupon.reactivate', entity: 'coupon', entityId: id });
    return coupon;
  }

  @Get()
  list() {
    return this.coupons.listCoupons();
  }
}

@Module({
  providers: [CouponsService],
  controllers: [CouponsController, AdminCouponsController, AdminOffersController, PlatformCouponsController, SuperAdminCouponsController],
  exports: [CouponsService],
})
export class CouponsModule {}
