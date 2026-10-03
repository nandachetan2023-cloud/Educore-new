import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
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
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';
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

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

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
      },
      select: COUPON_SELECT,
    });
  }

  async updateCoupon(id: number, dto: UpdateCouponDto) {
    const current = await this.requireCoupon(id);
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
  constructor(private coupons: CouponsService) {}

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
  validate(@CurrentUser('sub') userId: number, @Body() dto: ValidateCouponDto) {
    return this.coupons.preview(userId, dto.code);
  }
}

@ApiTags('admin coupons')
@Controller('admin/coupons')
@Roles(Principal.ADMIN)
export class AdminCouponsController {
  constructor(private coupons: CouponsService) {}

  @Get('summary')
  summary() {
    return this.coupons.summary();
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
  create(@Body() dto: CouponDto) {
    return this.coupons.createCoupon(dto);
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

@Module({
  providers: [CouponsService],
  controllers: [CouponsController, AdminCouponsController, AdminOffersController],
  exports: [CouponsService],
})
export class CouponsModule {}
