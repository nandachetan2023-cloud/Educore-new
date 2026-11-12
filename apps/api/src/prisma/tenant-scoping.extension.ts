import { Prisma } from '@prisma/client';

/**
 * Every model that belongs to exactly one tenant. Everything NOT in this list
 * (Admin, Tenant, Plan, Subscription) is platform-level and must be queried
 * via the unscoped RAW_PRISMA client instead.
 */
export const TENANT_SCOPED_MODELS = [
  'User',
  'CourseLanguage',
  'CourseLevel',
  'CourseCategory',
  'Course',
  'CourseChapter',
  'CourseChapterLession',
  'Tag',
  'CourseTag',
  'Cart',
  'Wishlist',
  'Order',
  'OrderItem',
  'Coupon',
  'CouponRedemption',
  'Offer',
  'Enrollment',
  'PaymentSetting',
  'PayoutGateway',
  'InstructorPayoutInformation',
  'Withdraw',
  'WatchHistory',
  'Review',
  'CertificateBuilder',
  'CertificateBuilderItem',
  'Certificate',
  'MailQueueJob',
  'Setting',
  'SsoConfig',
  'Hero',
  'Feature',
  'AboutUsSection',
  'LatestCourseSection',
  'Newsletter',
  'BecomeInstructorSection',
  'VideoSection',
  'Brand',
  'FeaturedInstructor',
  'Testimonial',
  'Counter',
  'Contact',
  'ContactSetting',
  'TopBar',
  'Footer',
  'SocialLink',
  'FooterColumnOne',
  'FooterColumnTwo',
  'CustomPage',
  'BlogCategory',
  'Blog',
  'BlogComment',
] as const;

type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

const READ_OPS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']);
const WRITE_WHERE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

/**
 * Builds a Prisma Client Extension that transparently injects `tenantId`
 * into every query against a TENANT_SCOPED_MODELS model, using whatever
 * tenant id `getTenantId()` returns for the current request (backed by CLS).
 *
 * `getTenantId() == null` (no authenticated tenant principal, no resolved
 * host, no dev header) means the query runs UNSCOPED — this is intentional
 * for background/system contexts, but is exactly why cross-tenant code
 * (Superadmin console, billing webhooks, seed script) should use the
 * separate unscoped RAW_PRISMA client instead of relying on this fallback.
 */
export function tenantScopingExtension(getTenantId: () => number | null | undefined) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tenant-scoping',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_SCOPED_MODELS.includes(model as TenantScopedModel)) {
              return query(args);
            }
            const tenantId = getTenantId();
            if (tenantId == null) {
              return query(args);
            }

            const a = args as Record<string, unknown>;

            if (tenantId != null && tenantId <= 0) {
              throw new Error(`tenant-scoping: invalid tenantId ${tenantId} for model ${model}`);
            }

            if (READ_OPS.has(operation) || WRITE_WHERE_OPS.has(operation)) {
              a.where = { ...(a.where as object | undefined), tenantId };
            } else if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
              // Inject tenantId into findUnique where for tenant-scoped models.
              // Callers should use a compound unique index (tenantId, <field>) where possible;
              // otherwise Prisma will throw and the caller should use findFirst.
              a.where = { ...(a.where as object | undefined), tenantId };
              return query(a as typeof args);
            } else if (operation === 'create') {
              a.data = { ...(a.data as object | undefined), tenantId };
            } else if (operation === 'createMany') {
              const data = a.data as unknown[];
              a.data = Array.isArray(data) ? data.map((d) => ({ ...(d as object), tenantId })) : data;
            } else if (operation === 'upsert') {
              a.where = { ...(a.where as object | undefined), tenantId };
              a.create = { ...(a.create as object | undefined), tenantId };
            }

            return query(a as typeof args);
          },
        },
      },
    }),
  );
}
