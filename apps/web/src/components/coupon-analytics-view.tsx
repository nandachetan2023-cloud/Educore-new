'use client';

import { useEffect, useState } from 'react';
import { Download, ShoppingBag, Ticket, TrendingUp, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useBranding } from '@/lib/providers';
import { LineChart } from '@/components/charts';
import { csvStamp, downloadCsv, toCsv } from '@/lib/csv';

export interface CouponAnalyticsTotals {
  redemptions: number;
  uniqueUsers: number;
  couponsUsed: number;
  totalCoupons: number;
  activeCoupons: number;
  discountGiven: number;
  revenueWithCoupons: number;
  coursesSold: number;
  avgOrderValue: number;
  avgDiscount: number;
  avgCoursesPerOrder: number;
  discountRatePct: number;
  windowRedemptions: number;
  windowRevenue: number;
  windowDiscount: number;
  windowUniqueUsers: number;
}

export interface CouponAnalytics {
  windowDays: number;
  totals: CouponAnalyticsTotals;
  timeline: { date: string; redemptions: number; discount: number; revenue: number; users: number }[];
  coupons: {
    id: number; code: string; description: string | null; type: string; value: number;
    maxDiscount: number | null; target: string; state: 'active' | 'scheduled' | 'expired' | 'disabled';
    tenantId?: number; tenantName?: string | null;
    redemptions: number; uniqueUsers: number; discountGiven: number; revenueGenerated: number;
    avgOrderValue: number; avgDiscount: number; usageLimit: number | null; perUserLimit: number;
    usedCount: number; utilizationPct: number | null; firstUsedAt: string | null; lastUsedAt: string | null;
  }[];
  byTenant?: {
    tenantId: number; name: string | null; slug: string | null; redemptions: number;
    uniqueUsers: number; couponsUsed: number; discountGiven: number; revenueGenerated: number;
  }[];
  topUsers: {
    userId: number; name: string; email: string; image: string | null; role: string;
    redemptions: number; totalDiscount: number; totalSpend: number; avgDiscount: number;
    coupons: { code: string; uses: number; discount: number }[];
    firstUsedAt: string | null; lastUsedAt: string | null;
  }[];
  topCourses: {
    courseId: number; title: string; slug: string; thumbnail: string | null;
    redemptions: number; discount: number; revenue: number;
  }[];
  recentRedemptions: {
    id: number; couponCode: string; couponType: string; couponValue: number;
    tenantId?: number; tenantName?: string | null;
    userId: number; userName: string; userEmail: string; userImage: string | null;
    orderId: number; invoiceId: string | null; orderStatus: string | null; currency: string;
    discount: number; orderTotal: number; courseCount: number;
    courses: { id: number; title: string }[]; createdAt: string;
  }[];
}

const RANGES = [7, 30, 90, 365];

const STATE_STYLE: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600',
  scheduled: 'bg-blue-500/10 text-blue-600',
  expired: 'bg-slate-500/10 text-slate-500',
  disabled: 'bg-red-500/10 text-red-500',
};

function Kpi({ label, value, hint, tone = 'text-ink' }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[#EAE6DB] bg-white p-5 shadow-sm">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className={`mt-1 text-[26px] font-semibold tracking-tight ${tone}`}>{value}</div>
      {hint && <div className="mt-1 text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#EAE6DB] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#F0EDE4] px-6 py-4">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Coupon analytics shared by the tenant console and the platform console.
 * `showTenant` adds the workspace breakdown (the platform view spans every
 * tenant, a tenant admin only ever sees their own).
 */
export function CouponAnalyticsView({ showTenant = false }: { showTenant?: boolean }) {
  const branding = useBranding();
  const [data, setData] = useState<CouponAnalytics | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currency = branding?.currency ?? 'INR';
  const fmt = (n: number, c = currency) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    setLoading(true);
    api<CouponAnalytics>(`/admin/coupons/analytics?days=${days}`)
      .then(setData)
      .catch(() => setError('Could not load coupon analytics'))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading && !data) {
    return <div className="py-20 text-center text-muted">Loading analytics…</div>;
  }

  const t = data?.totals;
  const maxRedemptions = Math.max(1, ...(data?.timeline.map((d) => d.redemptions) ?? [1]));
  const chartData = (data?.timeline ?? []).map((d) => ({ label: d.date.slice(5), value: d.redemptions }));

  const exportCouponCsv = () => {
    const headers = ['Code', 'State', 'Type', 'Value', 'Max discount', 'Redemptions', 'Unique users', 'Discount given', 'Revenue generated', 'Avg order value', 'Used', 'Usage limit', 'Utilisation %', 'First used', 'Last used'];
    const rows = (data?.coupons ?? []).map((c) => [
      c.code, c.state, c.type, c.value, c.maxDiscount ?? '', c.redemptions, c.uniqueUsers,
      c.discountGiven, c.revenueGenerated, c.avgOrderValue, c.usedCount, c.usageLimit ?? 'unlimited',
      c.utilizationPct ?? '', c.firstUsedAt ?? '', c.lastUsedAt ?? '',
    ]);
    downloadCsv(`coupon-performance-${csvStamp()}`, toCsv(headers, rows));
  };

  const exportUsersCsv = () => {
    const headers = ['User ID', 'Name', 'Email', 'Role', 'Redemptions', 'Codes used', 'Discount taken', 'Total spend', 'Avg discount', 'First used', 'Last used'];
    const rows = (data?.topUsers ?? []).map((u) => [
      u.userId, u.name, u.email, u.role, u.redemptions, u.coupons.map((c) => `${c.code} x${c.uses}`).join(' | '),
      u.totalDiscount, u.totalSpend, u.avgDiscount, u.firstUsedAt ?? '', u.lastUsedAt ?? '',
    ]);
    downloadCsv(`coupon-users-${csvStamp()}`, toCsv(headers, rows));
  };

  const exportRedemptionsCsv = () => {
    const headers = ['Date', 'Coupon', 'Type', 'Value', 'User ID', 'User', 'Email', 'Invoice', 'Order status', 'Courses', 'Course count', 'Order total', 'Discount', 'Currency'];
    const rows = (data?.recentRedemptions ?? []).map((r) => [
      r.createdAt, r.couponCode, r.couponType, r.couponValue, r.userId, r.userName, r.userEmail,
      r.invoiceId ?? `#${r.orderId}`, r.orderStatus ?? '', r.courses.map((c) => c.title).join(' | '),
      r.courseCount, r.orderTotal, r.discount, r.currency,
    ]);
    downloadCsv(`coupon-redemptions-${csvStamp()}`, toCsv(headers, rows));
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[12.5px] font-semibold text-brand">SALES PROMOTIONS</p>
          <h2 className="text-[24px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-admin-display)' }}>Coupon analytics</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Who redeemed which code, how much discount each coupon gave away, and the revenue it unlocked.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-full border border-[#E6E2D8] bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                days === r ? 'bg-brand text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {r === 365 ? '1y' : `${r}d`}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={exportCouponCsv} className="btn-ghost gap-1.5">
          <Download size={15} /> Coupons CSV
        </button>
        <button onClick={exportUsersCsv} className="btn-ghost gap-1.5">
          <Download size={15} /> Users CSV
        </button>
        <button onClick={exportRedemptionsCsv} className="btn-ghost gap-1.5">
          <Download size={15} /> Redemptions CSV
        </button>
      </div>

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Redemptions" value={String(t?.redemptions ?? 0)} hint={`${t?.windowRedemptions ?? 0} in the last ${days} days`} />
        <Kpi label="Unique users" value={String(t?.uniqueUsers ?? 0)} hint={`${t?.windowUniqueUsers ?? 0} in the last ${days} days`} />
        <Kpi label="Discount given away" value={fmt(t?.discountGiven ?? 0)} hint={`${t?.discountRatePct ?? 0}% of coupon revenue`} tone="text-amber-600" />
        <Kpi label="Revenue with coupons" value={fmt(t?.revenueWithCoupons ?? 0)} hint={`avg order ${fmt(t?.avgOrderValue ?? 0)}`} tone="text-green-600" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Codes in use" value={`${t?.couponsUsed ?? 0} / ${t?.totalCoupons ?? 0}`} hint={`${t?.activeCoupons ?? 0} currently active`} />
        <Kpi label="Courses sold" value={String(t?.coursesSold ?? 0)} hint={`${t?.avgCoursesPerOrder ?? 0} per order`} />
        <Kpi label="Avg discount / order" value={fmt(t?.avgDiscount ?? 0)} />
        <Kpi label="Window revenue" value={fmt(t?.windowRevenue ?? 0)} hint={`${fmt(t?.windowDiscount ?? 0)} discounted`} />
      </div>

      {showTenant && (data?.byTenant?.length ?? 0) > 0 && (
        <Section title="By workspace" action={<TrendingUp size={15} className="text-muted" />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#F0EDE4] text-[12px] uppercase tracking-wide text-muted">
                  <th className="px-6 py-3 font-medium">Workspace</th>
                  <th className="px-4 py-3 font-medium">Redemptions</th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Codes used</th>
                  <th className="px-4 py-3 font-medium">Discount given</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F3EC]">
                {data!.byTenant!.map((t2) => (
                  <tr key={t2.tenantId} className="transition hover:bg-[#FAFAF6]">
                    <td className="px-6 py-3.5 font-semibold">{t2.name ?? `Tenant #${t2.tenantId}`}</td>
                    <td className="px-4 py-3.5 font-semibold">{t2.redemptions}</td>
                    <td className="px-4 py-3.5 text-muted">{t2.uniqueUsers}</td>
                    <td className="px-4 py-3.5 text-muted">{t2.couponsUsed}</td>
                    <td className="px-4 py-3.5 font-semibold text-amber-600">{fmt(t2.discountGiven)}</td>
                    <td className="px-4 py-3.5 font-semibold text-green-600">{fmt(t2.revenueGenerated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section
        title={`Redemptions over the last ${days} days`}
        action={<span className="text-[12px] text-muted">peak {maxRedemptions} / day</span>}
      >
        <div className="px-6 py-5">
          {chartData.some((d) => d.value > 0) ? (
            <LineChart data={chartData} height={220} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">No redemptions in this window yet.</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Redemptions', value: String(t?.windowRedemptions ?? 0) },
              { label: 'Discount', value: fmt(t?.windowDiscount ?? 0) },
              { label: 'Revenue', value: fmt(t?.windowRevenue ?? 0) },
              { label: 'Users', value: String(t?.windowUniqueUsers ?? 0) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-[#F7F5F0] px-4 py-3">
                <div className="text-[11.5px] text-muted">{s.label}</div>
                <div className="text-[17px] font-semibold">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Performance by coupon" action={<span className="text-[12px] text-muted">{data?.coupons.length ?? 0} codes</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#F0EDE4] text-[12px] uppercase tracking-wide text-muted">
                <th className="px-6 py-3 font-medium">Code</th>
                {showTenant && <th className="px-4 py-3 font-medium">Workspace</th>}
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Uses</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Discount given</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
                <th className="px-4 py-3 font-medium">Avg order</th>
                <th className="px-4 py-3 font-medium">Utilisation</th>
                <th className="px-4 py-3 font-medium">Last used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F3EC]">
              {(data?.coupons ?? []).map((c) => (
                <tr key={c.id} className="transition hover:bg-[#FAFAF6]">
                  <td className="px-6 py-3.5">
                    <div className="font-semibold">{c.code}</div>
                    {c.description && <div className="text-[12px] text-muted">{c.description}</div>}
                  </td>
                  {showTenant && <td className="px-4 py-3.5 text-muted">{c.tenantName ?? '—'}</td>}
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${STATE_STYLE[c.state]}`}>{c.state}</span>
                  </td>
                  <td className="px-4 py-3.5 font-semibold">{c.redemptions}</td>
                  <td className="px-4 py-3.5 text-muted">{c.uniqueUsers}</td>
                  <td className="px-4 py-3.5 font-semibold text-amber-600">{fmt(c.discountGiven)}</td>
                  <td className="px-4 py-3.5 font-semibold text-green-600">{fmt(c.revenueGenerated)}</td>
                  <td className="px-4 py-3.5 text-muted">{c.redemptions ? fmt(c.avgOrderValue) : '—'}</td>
                  <td className="px-4 py-3.5">
                    {c.utilizationPct == null ? (
                      <span className="text-muted">unlimited</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[#EDEAE2]">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${c.utilizationPct}%` }} />
                        </span>
                        <span className="text-[12px] text-muted">{c.usedCount}/{c.usageLimit}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[12.5px] text-muted">
                    {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleDateString() : 'never'}
                  </td>
                </tr>
              ))}
              {(data?.coupons.length ?? 0) === 0 && (
                <tr><td colSpan={10} className="px-6 py-10 text-center text-sm text-muted">No coupons yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Users who redeemed" action={<Users size={15} className="text-muted" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#F0EDE4] text-[12px] uppercase tracking-wide text-muted">
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Codes used</th>
                <th className="px-4 py-3 font-medium">Redemptions</th>
                <th className="px-4 py-3 font-medium">Discount taken</th>
                <th className="px-4 py-3 font-medium">Total spend</th>
                <th className="px-4 py-3 font-medium">First / last</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F3EC]">
              {(data?.topUsers ?? []).map((u) => (
                <tr key={u.userId} className="transition hover:bg-[#FAFAF6]">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft text-[11px] font-bold text-brand">
                        {u.image ? <img src={u.image} alt="" className="h-full w-full object-cover" /> : u.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{u.name}</span>
                        <span className="block truncate text-[12px] text-muted">{u.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 capitalize text-muted">{u.role}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {u.coupons.map((c) => (
                        <span key={c.code} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                          {c.code} ×{c.uses}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-semibold">{u.redemptions}</td>
                  <td className="px-4 py-3.5 font-semibold text-amber-600">{fmt(u.totalDiscount)}</td>
                  <td className="px-4 py-3.5 font-semibold text-green-600">{fmt(u.totalSpend)}</td>
                  <td className="px-4 py-3.5 text-[12.5px] text-muted">
                    {u.firstUsedAt ? new Date(u.firstUsedAt).toLocaleDateString() : '—'}
                    {' → '}
                    {u.lastUsedAt ? new Date(u.lastUsedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {(data?.topUsers.length ?? 0) === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-muted">No one has redeemed a coupon yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Courses that sold with a coupon" action={<ShoppingBag size={15} className="text-muted" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#F0EDE4] text-[12px] uppercase tracking-wide text-muted">
                <th className="px-6 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Sales</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F3EC]">
              {(data?.topCourses ?? []).map((c) => (
                <tr key={c.courseId} className="transition hover:bg-[#FAFAF6]">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-12 shrink-0 overflow-hidden rounded-lg border border-[#EAE6DB]">
                        <img src={c.thumbnail || `https://picsum.photos/seed/educore-${c.courseId}/320/180`} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </span>
                      <span className="font-semibold">{c.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-semibold">{c.redemptions}</td>
                  <td className="px-4 py-3.5 font-semibold text-amber-600">{fmt(c.discount)}</td>
                  <td className="px-4 py-3.5 font-semibold text-green-600">{fmt(c.revenue)}</td>
                </tr>
              ))}
              {(data?.topCourses.length ?? 0) === 0 && (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-muted">No coupon sales yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recent redemptions" action={<Ticket size={15} className="text-muted" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#F0EDE4] text-[12px] uppercase tracking-wide text-muted">
                <th className="px-6 py-3 font-medium">Buyer</th>
                {showTenant && <th className="px-4 py-3 font-medium">Workspace</th>}
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Courses</th>
                <th className="px-4 py-3 font-medium">Order total</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F3EC]">
              {(data?.recentRedemptions ?? []).map((r) => (
                <tr key={r.id} className="transition hover:bg-[#FAFAF6]">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft text-[11px] font-bold text-brand">
                        {r.userImage ? <img src={r.userImage} alt="" className="h-full w-full object-cover" /> : r.userName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{r.userName}</span>
                        <span className="block truncate text-[12px] text-muted">{r.userEmail}</span>
                      </span>
                    </div>
                  </td>
                  {showTenant && <td className="px-4 py-3.5 text-muted">{r.tenantName ?? '—'}</td>}
                  <td className="px-4 py-3.5">
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">{r.couponCode}</span>
                  </td>
                  <td className="px-4 py-3.5 text-[12.5px] text-muted">
                    {r.invoiceId ?? `#${r.orderId}`}
                    {r.orderStatus && <span className="ml-1 capitalize">· {r.orderStatus}</span>}
                  </td>
                  <td className="px-4 py-3.5 text-[12.5px] text-muted">
                    {r.courses.length ? r.courses.map((c) => c.title).join(', ') : `${r.courseCount} course(s)`}
                  </td>
                  <td className="px-4 py-3.5 font-semibold">{fmt(r.orderTotal, r.currency)}</td>
                  <td className="px-4 py-3.5 font-semibold text-amber-600">−{fmt(r.discount, r.currency)}</td>
                  <td className="px-4 py-3.5 text-[12.5px] text-muted">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {(data?.recentRedemptions.length ?? 0) === 0 && (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-muted">No redemptions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
