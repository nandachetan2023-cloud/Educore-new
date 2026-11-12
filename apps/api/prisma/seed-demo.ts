/**
 * Demo data for the admin console.
 *
 * The base seed creates the catalog (tenants, users, courses, orders) but leaves
 * the activity trail and coupon usage empty — so "Activity logs" and "Coupon
 * analytics" have nothing to show on a fresh install. This script fills both
 * with realistic, workspace-scoped rows:
 *
 *   • audit logs    — logins, course/coupon/order activity over the last 45 days
 *   • coupon usage  — redemptions of the workspace's coupons against real orders
 *
 * It is idempotent: running it twice won't duplicate rows (it checks what is
 * already there first), and it never touches tenants other than the one given.
 *
 * Usage:
 *   npm run prisma:seed:demo --workspace=@educore/api -- --tenant=14
 *   npm run prisma:seed:demo --workspace=@educore/api -- --tenant=14 --reset
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const arg = (name: string, fallback?: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const has = (flag: string) => process.argv.includes(`--${flag}`);

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const int = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(arr: T[]): T => arr[int(0, arr.length - 1)];
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000 - int(0, 23) * 3600_000);
const round2 = (n: number) => Math.round(n * 100) / 100;

type LogSeed = {
  action: string;
  entity: string;
  entityId?: number;
  actorType: 'admin' | 'user' | 'system';
  actorId?: number;
  actorName?: string;
  actorRole?: string;
  meta?: Prisma.InputJsonValue;
};

async function seedAuditLogs(tenantId: number) {
  const admins = await prisma.admin.findMany({ where: { tenantId }, select: { id: true, email: true, name: true, role: true } });
  const users = await prisma.user.findMany({ where: { tenantId }, select: { id: true, email: true, name: true, role: true } });
  const courses = await prisma.course.findMany({ where: { tenantId }, select: { id: true, title: true, instructorId: true } });
  const coupons = await prisma.coupon.findMany({ where: { tenantId }, select: { id: true, code: true } });
  const orders = await prisma.order.findMany({ where: { tenantId }, select: { id: true, invoiceId: true } });

  if (!admins.length && !users.length) {
    console.log(`› tenant ${tenantId} has no admin or user accounts — skipping audit logs`);
    return 0;
  }

  const admin = admins[0];
  const rows: LogSeed[] = [];

  const push = (seed: LogSeed, days: number) => {
    const actor = seed.actorType === 'admin' ? admin : seed.actorType === 'user' ? pick(users) : null;
    rows.push({
      ...seed,
      actorId: seed.actorId ?? actor?.id,
      actorName: seed.actorName ?? actor?.email ?? 'system',
      actorRole: seed.actorRole ?? (seed.actorType === 'admin' ? `admin:${admin?.role ?? 'admin'}` : seed.actorType === 'user' ? (actor?.role ?? 'user') : 'system'),
    });
  };

  // Logins
  for (let i = 0; i < 26; i++) {
    const days = rand(0, 44);
    push({ action: 'auth.login', entity: 'user', actorType: 'user', meta: { email: pick(users)?.email ?? 'user@example.com' } }, days);
    if (i % 3 === 0) {
      push({ action: 'auth.login_failed', entity: 'user', actorType: 'system', meta: { reason: 'invalid password' } }, days);
    }
  }

  // Course lifecycle
  for (const course of courses) {
    push({ action: 'course.create', entity: 'course', entityId: course.id, actorType: 'user', meta: { title: course.title } }, rand(5, 44));
    push({ action: 'course.update', entity: 'course', entityId: course.id, actorType: 'user', meta: { title: course.title, fields: ['description', 'thumbnail'] } }, rand(1, 5));
    if (course.instructorId) {
      push({ action: 'course.submit_for_review', entity: 'course', entityId: course.id, actorType: 'user', actorId: course.instructorId, meta: { title: course.title } }, rand(1, 6));
    }
    push({ action: 'course.approve', entity: 'course', entityId: course.id, actorType: 'admin', meta: { decision: 'approved' } }, rand(0, 4));
  }

  // Coupons
  for (const coupon of coupons) {
    push({ action: 'coupon.create', entity: 'coupon', entityId: coupon.id, actorType: 'admin', meta: { code: coupon.code } }, rand(10, 44));
    push({ action: 'coupon.update', entity: 'coupon', entityId: coupon.id, actorType: 'admin', meta: { code: coupon.code, fields: ['endsAt'] } }, rand(2, 12));
  }

  // Orders
  for (const order of orders) {
    push({ action: 'order.paid', entity: 'order', entityId: order.id, actorType: 'user', meta: { invoiceId: order.invoiceId } }, rand(0, 40));
    push({ action: 'order.fulfill', entity: 'order', entityId: order.id, actorType: 'system', meta: { invoiceId: order.invoiceId, courses: int(1, 3) } }, rand(0, 40));
  }

  // Settings / workspace churn
  for (let i = 0; i < 10; i++) {
    push({ action: 'settings.update', entity: 'settings', actorType: 'admin', meta: { fields: pick(['commissionRate', 'currency', 'supportEmail']) } }, rand(0, 30));
  }
  for (let i = 0; i < 6; i++) {
    push({ action: 'user.update', entity: 'user', actorType: 'admin', meta: { fields: pick(['approveStatus', 'headline', 'bio']) } }, rand(0, 30));
  }
  push({ action: 'tenant.update', entity: 'tenant', entityId: tenantId, actorType: 'admin', meta: { fields: ['name'] } }, rand(0, 30));

  const existing = await prisma.auditLog.count({ where: { tenantId } });
  let created = 0;
  for (const row of rows) {
    await prisma.auditLog.create({
      data: {
        tenantId,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId ?? null,
        meta: row.meta ?? undefined,
        actorType: row.actorType,
        actorId: row.actorId ?? null,
        actorName: row.actorName ?? null,
        actorRole: row.actorRole ?? null,
        ip: `10.0.${int(0, 12)}.${int(2, 250)}`,
        userAgent: pick([
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) Safari/17',
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2) Mobile Safari/17',
        ]),
        createdAt: daysAgo(rand(0, 44)),
      },
    });
    created += 1;
  }
  console.log(`› audit logs: +${created} (tenant ${tenantId} had ${existing} before)`);
  return created;
}

async function seedCouponUsage(tenantId: number) {
  const coupons = await prisma.coupon.findMany({ where: { tenantId } });
  const orders = await prisma.order.findMany({
    where: { tenantId, status: 'approved' },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  const students = await prisma.user.findMany({ where: { tenantId, role: 'student' }, select: { id: true } });

  if (!coupons.length || !orders.length || !students.length) {
    console.log(`› tenant ${tenantId} needs coupons, approved orders and students to seed usage — skipping`);
    return 0;
  }

  const existing = await prisma.couponRedemption.count({ where: { tenantId } });
  let created = 0;

  for (const order of orders) {
    // Only some orders used a coupon — that ratio is what the analytics shows.
    if (Math.random() > 0.55) continue;
    const coupon = pick(coupons);
    const gross = round2(order.items.reduce((n, i) => n + i.price, 0) || order.totalAmount);
    const discount = coupon.type === 'percentage'
      ? round2(Math.min(gross, (gross * coupon.value) / 100))
      : round2(Math.min(gross, coupon.value));
    const total = round2(gross - discount);

    try {
      await prisma.couponRedemption.create({
        data: {
          tenantId,
          couponId: coupon.id,
          orderId: order.id,
          userId: order.buyerId,
          amount: discount,
          orderTotal: total,
          courseCount: order.items.length,
          createdAt: daysAgo(rand(0, 38)),
        },
      });
      created += 1;
    } catch {
      // A unique orderId already has a redemption — skip it.
    }
  }

  // Keep the denormalised counter in step with the rows we just wrote.
  for (const coupon of coupons) {
    const used = await prisma.couponRedemption.count({ where: { couponId: coupon.id } });
    await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: used } });
  }

  console.log(`› coupon redemptions: +${created} (tenant ${tenantId} had ${existing} before)`);
  return created;
}

async function main() {
  const tenantArg = arg('tenant');
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
  if (!tenants.length) {
    console.log('› no tenants found — run `npm run db:seed` first');
    return;
  }

  const targets = tenantArg
    ? tenants.filter((t) => t.id === Number(tenantArg))
    : tenants.filter((t) => t.id !== 0);

  if (!targets.length) {
    console.log(`› no tenant with id ${tenantArg}`);
    return;
  }

  for (const tenant of targets) {
    console.log(`\n▪ ${tenant.name} (${tenant.slug}) — tenant ${tenant.id}`);
    if (has('reset')) {
      const removed = await prisma.couponRedemption.deleteMany({ where: { tenantId: tenant.id } });
      const removedLogs = await prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } });
      console.log(`› reset: removed ${removed.count} redemptions and ${removedLogs.count} audit logs`);
    }
    await seedAuditLogs(tenant.id);
    await seedCouponUsage(tenant.id);
  }
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
