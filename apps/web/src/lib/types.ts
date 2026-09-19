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

export interface TenantRow {
  id: number;
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

export function priceLabel(course: { price?: number | null; discount?: number | null }, currency: string) {
  const net = Math.max(0, (course.price ?? 0) - (course.discount ?? 0));
  if (net === 0) return 'Free';
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });
  return fmt.format(net);
}
