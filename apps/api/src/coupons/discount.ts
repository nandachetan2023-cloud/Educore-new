/**
 * Pure discount math shared by the cart, the coupon preview endpoint and
 * checkout. No Nest/Prisma imports so it can be unit tested on its own.
 *
 * Money is a Float everywhere in this schema (see Course.price), so every
 * amount is rounded to 2 decimals and the order total is always derived from
 * the per-course prices — never computed independently — otherwise the
 * gateway charge and the instructor commission could drift apart.
 */

export type DiscountType = 'percentage' | 'fixed';
export type DiscountTarget = 'all' | 'courses' | 'categories';

/** A coupon or an offer, normalized to the same shape for the math below. */
export interface PromoRule {
  kind: 'coupon' | 'offer';
  id?: number;
  code?: string | null;
  title: string;
  type: DiscountType;
  value: number;
  maxDiscount?: number | null;
  target: DiscountTarget;
  courseIds: number[];
  categoryIds: number[];
}

/** What "who this promo covers" needs to know about a course. */
export interface PromoTargetCourse {
  id: number;
  categoryId?: number | null;
}

/** Minimal course shape the engine needs. `base` is the net course price. */
export interface PricableCourse extends PromoTargetCourse {
  base: number;
}

export interface PricedLine {
  courseId: number;
  base: number;
  discount: number;
  final: number;
}

export interface PricedCart {
  lines: PricedLine[];
  /** Sum of net course prices before any promotion. */
  subtotal: number;
  discountTotal: number;
  total: number;
  /** The winning promotion, or null when nothing gave a real discount. */
  promo: PromoRule | null;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Whether the rule's audience (all / specific courses / categories) covers this course. */
export function appliesTo(rule: PromoRule, course: PromoTargetCourse): boolean {
  if (rule.target === 'all') return true;
  if (rule.target === 'courses') return rule.courseIds.includes(course.id);
  return course.categoryId != null && rule.categoryIds.includes(course.categoryId);
}

/** Sum of the net prices the rule can actually discount. */
export function eligibleSubtotal(rule: PromoRule, courses: PricableCourse[]): number {
  return round2(
    courses
      .filter((c) => c.base > 0 && appliesTo(rule, c))
      .reduce((sum, c) => sum + c.base, 0),
  );
}

/**
 * Total discount for one rule plus its per-course split. Percentage rules are
 * taken proportionally off every eligible course and capped by `maxDiscount`;
 * fixed rules are consumed across eligible courses, most expensive first, so a
 * fixed amount is never spread thinner than it needs to be.
 */
export function computeDiscount(
  rule: PromoRule,
  courses: PricableCourse[],
): { total: number; perCourse: Map<number, number> } {
  const eligible = courses.filter((c) => c.base > 0 && appliesTo(rule, c));
  const perCourse = new Map<number, number>();
  if (eligible.length === 0 || rule.value <= 0) return { total: 0, perCourse };

  const eligibleBase = round2(eligible.reduce((sum, c) => sum + c.base, 0));

  if (rule.type === 'percentage') {
    let total = round2((eligibleBase * rule.value) / 100);
    if (rule.maxDiscount != null) total = Math.min(total, round2(rule.maxDiscount));
    total = Math.min(total, eligibleBase);
    if (total <= 0) return { total: 0, perCourse };

    for (const c of eligible) perCourse.set(c.id, round2((total * c.base) / eligibleBase));
    // Rounding each share leaves a stray cent or two — hand it to the priciest
    // course so the parts always add up to the advertised total.
    const drift = round2(total - round2([...perCourse.values()].reduce((s, v) => s + v, 0)));
    if (drift !== 0) {
      const priciest = eligible.reduce((a, b) => (a.base >= b.base ? a : b));
      perCourse.set(priciest.id, Math.max(0, round2(perCourse.get(priciest.id)! + drift)));
    }
    return { total, perCourse };
  }

  let remaining = Math.min(round2(rule.value), eligibleBase);
  for (const c of [...eligible].sort((a, b) => b.base - a.base)) {
    if (remaining <= 0) break;
    const take = round2(Math.min(c.base, remaining));
    perCourse.set(c.id, take);
    remaining = round2(remaining - take);
  }
  const total = round2([...perCourse.values()].reduce((s, v) => s + v, 0));
  return { total, perCourse };
}

/**
 * Prices a cart against the best promotion that applies. Only one promotion is
 * ever honoured per order — an entered coupon beats an automatic offer, but
 * only if it actually saves more, so shoppers never stack discounts by accident.
 */
export function priceCart(
  courses: PricableCourse[],
  candidates: (PromoRule | null | undefined)[],
): PricedCart {
  const subtotal = round2(courses.reduce((sum, c) => sum + Math.max(0, c.base), 0));

  let promo: PromoRule | null = null;
  let perCourse = new Map<number, number>();
  let best = 0;
  for (const rule of candidates) {
    if (!rule) continue;
    const { total, perCourse: split } = computeDiscount(rule, courses);
    // Strictly greater keeps the first candidate (the coupon) on a tie.
    if (total > best) {
      best = total;
      promo = rule;
      perCourse = split;
    }
  }

  const lines: PricedLine[] = courses.map((c) => {
    const base = Math.max(0, round2(c.base));
    const discount = round2(perCourse.get(c.id) ?? 0);
    return { courseId: c.id, base, discount, final: Math.max(0, round2(base - discount)) };
  });

  let total = round2(lines.reduce((sum, l) => sum + l.final, 0));
  let discountTotal = round2(subtotal - total);

  // Rounding the shares can push the discount a cent past the admin's cap.
  if (promo?.maxDiscount != null && discountTotal > round2(promo.maxDiscount)) {
    const excess = round2(discountTotal - round2(promo.maxDiscount));
    const line = lines.reduce((a, b) => (a.final >= b.final ? a : b));
    line.discount = Math.max(0, round2(line.discount - excess));
    line.final = Math.max(0, round2(line.base - line.discount));
    total = round2(lines.reduce((sum, l) => sum + l.final, 0));
    discountTotal = round2(subtotal - total);
  }

  return { lines, subtotal, discountTotal, total, promo };
}

/** Human-readable label used in the UI and in error messages. */
export function promoLabel(rule: PromoRule): string {
  const value = rule.type === 'percentage' ? `${trimNumber(rule.value)}%` : trimNumber(rule.value);
  return rule.kind === 'coupon' && rule.code
    ? `${rule.code} (${value} off)`
    : `${rule.title} (${value} off)`;
}

function trimNumber(n: number): string {
  return String(round2(n));
}
