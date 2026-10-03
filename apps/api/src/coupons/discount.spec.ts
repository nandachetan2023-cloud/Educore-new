import { PromoRule, computeDiscount, eligibleSubtotal, priceCart, round2 } from './discount';

const course = (id: number, base: number, categoryId: number | null = 1) => ({ id, base, categoryId });

const rule = (over: Partial<PromoRule> = {}): PromoRule => ({
  kind: 'coupon',
  code: 'SAVE10',
  title: 'SAVE10',
  type: 'percentage',
  value: 10,
  target: 'all',
  courseIds: [],
  categoryIds: [],
  ...over,
});

describe('discount engine', () => {
  describe('computeDiscount', () => {
    it('takes a percentage off every eligible course', () => {
      const { total, perCourse } = computeDiscount(rule({ value: 10 }), [course(1, 100), course(2, 50)]);
      expect(total).toBe(15);
      expect(perCourse.get(1)).toBe(10);
      expect(perCourse.get(2)).toBe(5);
    });

    it('caps a percentage at the maximum discount', () => {
      const { total } = computeDiscount(rule({ value: 50, maxDiscount: 20 }), [course(1, 200)]);
      expect(total).toBe(20);
    });

    it('never discounts more than the eligible subtotal', () => {
      const { total } = computeDiscount(rule({ value: 100 }), [course(1, 40)]);
      expect(total).toBe(40);
    });

    it('only discounts courses the rule targets', () => {
      const targeted = rule({ target: 'courses', courseIds: [2] });
      const items = [course(1, 100), course(2, 100)];
      expect(eligibleSubtotal(targeted, items)).toBe(100);
      const { total, perCourse } = computeDiscount(targeted, items);
      expect(total).toBe(10);
      expect(perCourse.has(1)).toBe(false);
      expect(perCourse.get(2)).toBe(10);
    });

    it('supports category targeting', () => {
      const targeted = rule({ target: 'categories', categoryIds: [2], value: 50 });
      const { total } = computeDiscount(targeted, [course(1, 100, 1), course(2, 100, 2)]);
      expect(total).toBe(50);
    });

    it('never spends a fixed discount on a course cheaper than the remainder', () => {
      const { total, perCourse } = computeDiscount(rule({ type: 'fixed', value: 120 }), [course(1, 100), course(2, 10)]);
      expect(total).toBe(110);
      expect(perCourse.get(1)).toBe(100);
      expect(perCourse.get(2)).toBe(10);
    });

    it('spends a fixed discount on the priciest course first', () => {
      const { perCourse } = computeDiscount(rule({ type: 'fixed', value: 30 }), [course(1, 10), course(2, 100)]);
      expect(perCourse.get(2)).toBe(30);
      expect(perCourse.has(1)).toBe(false);
    });

    it('keeps per-course shares adding up to the advertised total', () => {
      const items = [course(1, 33.33), course(2, 33.33), course(3, 33.34)];
      const { total, perCourse } = computeDiscount(rule({ value: 15 }), items);
      expect(round2([...perCourse.values()].reduce((s, v) => s + v, 0))).toBe(total);
      expect(total).toBe(round2(100 * 0.15));
    });

    it('ignores free and zero-value items', () => {
      const { total } = computeDiscount(rule({ value: 50 }), [course(1, 0)]);
      expect(total).toBe(0);
    });
  });

  describe('priceCart', () => {
    it('prices a cart with no promotion at the net course price', () => {
      const priced = priceCart([course(1, 100), course(2, 25.5)], []);
      expect(priced.subtotal).toBe(125.5);
      expect(priced.discountTotal).toBe(0);
      expect(priced.total).toBe(125.5);
      expect(priced.promo).toBeNull();
    });

    it('makes the order total equal the sum of the line prices', () => {
      const priced = priceCart([course(1, 19.99), course(2, 4.99)], [rule({ value: 15 })]);
      const sum = priced.lines.reduce((s, l) => s + l.final, 0);
      expect(round2(sum)).toBe(priced.total);
      expect(priced.total).toBe(round2(24.98 - 3.75));
    });

    it('honours the better of an entered coupon and an automatic offer', () => {
      const coupon = rule({ code: 'SAVE10', value: 10 });
      const offer = rule({ kind: 'offer', code: null, title: 'Flash sale', value: 30 });
      expect(priceCart([course(1, 100)], [coupon, offer]).promo?.title).toBe('Flash sale');
      expect(priceCart([course(1, 100)], [offer, coupon]).promo?.title).toBe('Flash sale');
    });

    it('keeps the coupon on a tie so the code the shopper typed is honoured', () => {
      const coupon = rule({ code: 'SAVE10', value: 10 });
      const offer = rule({ kind: 'offer', code: null, title: 'Flash sale', value: 10 });
      expect(priceCart([course(1, 100)], [coupon, offer]).promo?.code).toBe('SAVE10');
    });

    it('ignores a promotion that saves nothing', () => {
      const items = [course(1, 100)];
      const useless = rule({ target: 'courses', courseIds: [999], value: 50 });
      const priced = priceCart(items, [useless]);
      expect(priced.promo).toBeNull();
      expect(priced.total).toBe(100);
    });

    it('keeps a 100% coupon from going negative', () => {
      const priced = priceCart([course(1, 60), course(2, 40)], [rule({ value: 100 })]);
      expect(priced.total).toBe(0);
      expect(priced.discountTotal).toBe(100);
      expect(priced.lines.every((l) => l.final === 0)).toBe(true);
    });

    it('trims a rounding overshoot back to the cap', () => {
      const priced = priceCart([course(1, 10.01), course(2, 10.01), course(3, 10.01)], [
        rule({ value: 50, maxDiscount: 15 }),
      ]);
      expect(priced.discountTotal).toBeLessThanOrEqual(15);
      expect(priced.total).toBe(round2(30.03 - priced.discountTotal));
    });
  });
});
