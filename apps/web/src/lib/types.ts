export interface Branding {
  name: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  commissionRate: number;
}

export interface Instructor {
  id: number;
  name: string;
  image?: string;
  headline?: string;
  bio?: string;
}

export interface CourseCard {
  id: number;
  title: string;
  slug: string;
  thumbnail?: string | null;
  price?: number | null;
  discount?: number | null;
  duration?: string | null;
  instructor: Instructor;
  category?: { name: string; slug: string } | null;
  level?: { name: string } | null;
  averageRating?: number | null;
  _count: { reviews: number; enrollments: number };
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; lastPage: number };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  _count?: { courses: number };
}

export interface Me {
  id: number;
  name: string;
  email: string;
  image?: string;
  role?: 'student' | 'instructor';
  principal: 'admin' | 'instructor' | 'student';
  /** For admins: their tier. Only 'super_admin' can rebrand & manage admins. */
  adminRole?: 'admin' | 'super_admin';
  /** The tenant this principal belongs to. Null/absent for the platform superadmin. */
  tenantId?: number | null;
  wallet?: number;
}

export interface PlanRow {
  id: number;
  name: string;
  slug: string;
  priceMonthly: number; // minor units (cents)
  currency: string;
  isActive: boolean;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
}

export type TenantStatus = 'pending_setup' | 'active' | 'past_due' | 'suspended';

export interface PlatformStats {
  tenants: { total: number; active: number; pendingSetup: number; pastDue: number; suspended: number };
  mrr: number;
  revenueByPlan: { name: string; workspaces: number }[];
  learners: number;
  instructors: number;
  staff: number;
  courses: number;
  enrollments: number;
  orders: number;
  gmv: number;
}

export interface TenantRow {  id: number;
  name: string;
  slug: string;
  status: TenantStatus;
  manuallySuspended: boolean;
  customDomain?: string | null;
  domainStatus: 'none' | 'pending' | 'verified' | 'failed';
  createdAt: string;
  owner: { id: number; name: string; email: string };
  subscription: {
    id: number;
    status: string;
    stripeCustomerId?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
    plan: PlanRow;
  } | null;
}

export interface Hero {
  id: number;
  title: string;
  subTitle?: string | null;
  image?: string | null;
}

export interface Feature {
  id: number;
  icon?: string | null;
  title: string;
  description?: string | null;
}

export interface Testimonial {
  id: number;
  name: string;
  headline?: string | null;
  image?: string | null;
  comment: string;
  rating?: number | null;
}

export interface Counter {
  id: number;
  title: string;
  number: string;
}

export interface Brand {
  id: number;
  image: string;
}

export interface HomeCms {
  hero: Hero | null;
  features: Feature[];
  testimonials: Testimonial[];
  counters: Counter[];
  brands: Brand[];
}

export type DiscountType = 'percentage' | 'fixed';
export type DiscountTarget = 'all' | 'courses' | 'categories';

/** Admin-managed discount code students redeem at checkout. */
export interface Coupon {
  id: number;
  code: string;
  description?: string | null;
  type: DiscountType;
  value: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  target: DiscountTarget;
  courseIds: number[];
  categoryIds: number[];
  usageLimit?: number | null;
  perUserLimit: number;
  usedCount: number;
  startsAt?: string | null;
  endsAt?: string | null;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { redemptions: number };
  redemptions?: { id: number; amount: number; createdAt: string }[];
}

/** Time-boxed sale applied automatically to selected courses/categories. */
export interface Offer {
  id: number;
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  banner?: string | null;
  badge?: string | null;
  type: DiscountType;
  value: number;
  maxDiscount?: number | null;
  target: DiscountTarget;
  courseIds: number[];
  categoryIds: number[];
  priority: number;
  usedCount: number;
  startsAt?: string | null;
  endsAt?: string | null;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Storefront shape: an offer plus the courses it currently discounts. */
export interface StorefrontOffer extends Offer {
  valueLabel: string;
  courseCount: number;
  courses: { id: number; title: string; slug: string; thumbnail?: string | null; price?: number | null; discount?: number | null }[];
}

/** The promotion the server actually honored on a cart or order. */
export interface AppliedPromo {
  kind: 'coupon' | 'offer';
  id?: number | null;
  code?: string | null;
  title: string;
  type: DiscountType;
  value: number;
  valueLabel: string;
  maxDiscount?: number | null;
  label: string;
  target: DiscountTarget;
}

export interface CouponPreview {
  valid: true;
  code: string;
  title: string;
  kind: 'coupon' | 'offer';
  value: number;
  valueLabel: string;
  label: string;
  subtotal: number;
  discount: number;
  total: number;
}

export interface CouponSummary {
  activeCoupons: number;
  activeOffers: number;
  redemptions: number;
  revenueSaved: number;
  averageSaving: number;
}

/** "10% off" / "$5 off" — the wording used on both the console and the storefront. */
export function discountLabel(type: DiscountType, value: number): string {
  return type === 'percentage' ? `${value}% off` : `${value} off`;
}

export function priceLabel(course: { price?: number | null; discount?: number | null }, currency: string) {
  const net = Math.max(0, (course.price ?? 0) - (course.discount ?? 0));
  if (net === 0) return 'Free';
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  return fmt.format(net);
}
