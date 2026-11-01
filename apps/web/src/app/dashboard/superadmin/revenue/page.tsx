'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeDollarSign,
  CircleDollarSign,
  Coins,
  RefreshCcw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { BarList, LineChart } from '@/components/charts';
import { SuperAdminShell } from '@/components/superadmin-shell';
import type { PlatformRevenue } from '@/lib/types';

const money = (n: number, fraction = 0) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: fraction }).format(n);

const percent = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

/** Green when revenue grew, red when it fell; 0 shows as plain muted text. */
function Trend({ value }: { value: number }) {
  const up = value > 0;
  const down = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold ${
        up ? 'text-green-600' : down ? 'text-rose-500' : 'text-muted'
      }`}
    >
      {up && <TrendingUp className="h-3.5 w-3.5" />}
      {down && <TrendingUp className="h-3.5 w-3.5 -scale-y-100" />}
      {percent(value)} vs prior period
    </span>
  );
}

function Kpi({
  icon: Icon,
  tint,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  tint: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 font-display text-[32px] font-semibold leading-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

export default function RevenuePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [revenue, setRevenue] = useState<PlatformRevenue | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login?next=/dashboard/superadmin/revenue');
      return;
    }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    api<PlatformRevenue>('/admin/platform/revenue?days=30')
      .then(setRevenue)
      .catch(() => setRevenue(null));
  }, [user, loading, router]);

  if (loading || revenue === null) {
    return (
      <SuperAdminShell>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-line/60" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl bg-line/60 xl:col-span-2" />
          <div className="h-72 animate-pulse rounded-2xl bg-line/60" />
        </div>
      </SuperAdminShell>
    );
  }

  const series = revenue.revenueByDay.map((d) => ({
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: d.amount,
  }));
  const inWindow = revenue.revenueByDay.reduce((n, d) => n + d.amount, 0);

  return (
    <SuperAdminShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Revenue</h1>
          <p className="mt-1 text-[15px] text-muted">
            Everything computed live from the database at request time — subscription billings, approved
            course orders, and outgoing payouts. No sample or cached figures.
          </p>
        </div>
        <span className="badge">
          <CircleDollarSign className="h-3.5 w-3.5" /> Last 30 days window
        </span>
      </div>

      {/* KPI row */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-muted">Recurring revenue</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-green-500/10 text-green-600">
              <RefreshCcw className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 font-display text-[32px] font-semibold leading-tight text-ink">
            {money(revenue.mrr, 2)}
          </p>
          <p className="mt-1">
            <Trend value={revenue.trends.mrr} />
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-muted">Course sales (GMV)</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-brand">
              <BadgeDollarSign className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 font-display text-[32px] font-semibold leading-tight text-ink">
            {money(revenue.gmv, 2)}
          </p>
          <p className="mt-1">
            <Trend value={revenue.trends.gmv} />
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-muted">Approved orders</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
              <BadgeDollarSign className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 font-display text-[32px] font-semibold leading-tight text-ink">
            {revenue.orders.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">paid course orders, all time</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-muted">Commissions owed</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <Coins className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 font-display text-[32px] font-semibold leading-tight text-ink">
            {money(revenue.payouts.instructors.pending, 2)}
          </p>
          <p className="mt-1 text-xs text-muted">
            instructor withdrawals pending settlement
          </p>
        </div>
      </section>

      {/* Trend + plan mix */}
      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-ink">Course revenue — last 30 days</h2>
              <p className="mt-0.5 text-[13px] text-muted">Approved orders bucketed by day, all workspaces.</p>
            </div>
            <span className="badge">{money(inWindow, 0)} in window</span>
          </div>
          <div className="mt-4 text-brand">
            <LineChart data={series} height={180} formatValue={(n) => money(n, 0)} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
            <h2 className="font-bold text-ink">Plan mix</h2>
            <p className="mt-0.5 text-[13px] text-muted">Monthly revenue by active plan.</p>
            <div className="mt-4">
              <BarList
                data={revenue.revenueByPlan.map((p) => ({ label: `${p.name} · ${p.workspaces} ws`, value: p.mrr }))}
                formatValue={(n) => money(n, 0)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <Wallet className="h-4.5 w-4.5 text-brand" /> Payouts
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="min-w-0 flex-1 truncate text-muted">Instructor withdrawals paid</span>
                <span className="shrink-0 text-right text-ink">
                  <span className="font-bold">{money(revenue.payouts.instructors.paid, 2)}</span>
                  <span className="ml-2 text-xs text-muted">{money(revenue.payouts.instructors.pending, 2)} pending</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SuperAdminShell>
  );
}
