'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Palette,
  Plus,
  Search,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { BarList, LineChart } from '@/components/charts';
import { SuperAdminShell } from '@/components/superadmin-shell';
import { TenantStatusBadge } from '@/components/tenant-status-badge';
import type { PlatformStats, TenantRow, TenantStatus } from '@/lib/types';

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

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
    <div className="group rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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

/** Cumulative workspaces per month for the last 8 months. */
function growthSeries(tenants: TenantRow[]): { label: string; value: number }[] {
  const now = new Date();
  return Array.from({ length: 8 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (7 - k), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    return {
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      value: tenants.filter((t) => new Date(t.createdAt).getTime() < end).length,
    };
  });
}

type StatusFilter = 'all' | TenantStatus;

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending_setup', label: 'Pending' },
  { key: 'past_due', label: 'Past due' },
  { key: 'suspended', label: 'Suspended' },
];

export default function SuperadminOverview() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[] | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?next=/dashboard/superadmin');
      return;
    }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    api<TenantRow[]>('/admin/tenants')
      .then(setTenants)
      .catch(() => setTenants([]));
    api<PlatformStats>('/admin/platform/stats')
      .then(setStats)
      .catch(() => setStats(null));
  }, [user, authLoading, router]);

  const growth = useMemo(() => growthSeries(tenants ?? []), [tenants]);

  const attention = useMemo(
    () => (tenants ?? []).filter((t) => t.status !== 'active'),
    [tenants],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tenants ?? [])
      .filter((t) => (filter === 'all' ? true : t.status === filter))
      .filter((t) =>
        q ? `${t.name} ${t.slug} ${t.owner.email}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [tenants, query, filter]);

  if (authLoading || tenants === null) {
    return (
      <SuperAdminShell>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-line/60" />
          ))}
        </div>
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-line/60" />
      </SuperAdminShell>
    );
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SuperAdminShell>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-brand">Platform operations · {today}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">
            Good {daypart()}, {user?.name?.split(' ')[0] ?? 'Admin'}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted">
            {stats
              ? `${stats.tenants.active} active workspaces · ${stats.learners.toLocaleString()} learners · ${money(stats.mrr)}/mo recurring`
              : 'Loading platform figures…'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/superadmin/plans" className="btn-ghost rounded-full text-sm">
            <CreditCard className="h-4 w-4" /> Plans
          </Link>
          <Link href="/dashboard/superadmin/tenants" className="btn-primary rounded-full text-sm">
            <Plus className="h-4 w-4" /> New sub-account
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={BadgeDollarSign}
          tint="bg-green-500/10 text-green-600"
          label="Recurring revenue"
          value={money(stats?.mrr ?? 0)}
          detail="per month, active subscriptions"
        />
        <Kpi
          icon={Building2}
          tint="bg-blue-500/10 text-brand"
          label="Active workspaces"
          value={String(stats?.tenants.active ?? 0)}
          detail={`${stats?.tenants.total ?? 0} total · ${stats?.tenants.pendingSetup ?? 0} pending setup`}
        />
        <Kpi
          icon={GraduationCap}
          tint="bg-violet-500/10 text-violet-600"
          label="Learners"
          value={(stats?.learners ?? 0).toLocaleString()}
          detail={`${(stats?.instructors ?? 0).toLocaleString()} instructors · ${(stats?.enrollments ?? 0).toLocaleString()} enrollments`}
        />
        <Kpi
          icon={BookOpen}
          tint="bg-amber-500/10 text-amber-600"
          label="Courses live"
          value={(stats?.courses ?? 0).toLocaleString()}
          detail="across all workspaces"
        />
        <Kpi
          icon={CreditCard}
          tint="bg-rose-500/10 text-rose-500"
          label="Course sales (GMV)"
          value={money(stats?.gmv ?? 0)}
          detail={`${stats?.orders ?? 0} paid orders to date`}
        />
      </section>

      {/* Attention queue */}
      {attention.length > 0 ? (
        <section className="mt-6 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/[0.06]">
          <div className="flex items-center gap-2.5 px-6 pt-5">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="font-bold text-ink">
              {attention.length} workspace{attention.length === 1 ? '' : 's'} need{attention.length === 1 ? 's' : ''} attention
            </h2>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {attention.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/superadmin/tenants/${t.id}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 transition hover:shadow-sm"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand">
                  {t.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{t.name}</span>
                  <span className="block truncate text-xs text-muted">{t.owner.email}</span>
                </span>
                <TenantStatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-6 flex items-center gap-3 rounded-2xl border border-green-500/25 bg-green-500/[0.07] px-6 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <p className="text-sm font-medium text-ink">
            All clear — every workspace is active with no billing or setup issues.
          </p>
        </section>
      )}

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Growth */}
        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-ink">Workspace growth</h2>
              <p className="mt-0.5 text-[13px] text-muted">Total workspaces over the last 8 months.</p>
            </div>
            <span className="badge">+{growth.length > 1 ? growth[growth.length - 1].value - growth[0].value : 0} this period</span>
          </div>
          <div className="mt-4 text-brand">
            <LineChart data={growth} height={170} formatValue={(n) => `${n}`} />
          </div>
        </div>

        <div className="space-y-6">
          {/* Revenue mix */}
          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
            <h2 className="font-bold text-ink">Workspaces by plan</h2>
            <p className="mt-0.5 text-[13px] text-muted">Where recurring revenue comes from.</p>
            <div className="mt-4">
              <BarList
                data={(stats?.revenueByPlan ?? []).map((p) => ({ label: p.name, value: p.workspaces }))}
                formatValue={(n) => `${n}`}
              />
            </div>
          </div>

          {/* Brand promo */}
          <div className="relative overflow-hidden rounded-2xl bg-brand p-6 text-white shadow-lift">
            <Palette className="h-7 w-7 text-white/70" />
            <h2 className="mt-4 text-xl font-bold">White-label control</h2>
            <p className="mt-2 text-sm leading-6 text-white/75">
              Set any workspace's brand, domain, and pricing mix from its detail page.
            </p>
            <Link
              href="/dashboard/superadmin/tenants"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand transition hover:brightness-95"
            >
              Open sub-accounts <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Workspaces */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-bold text-ink">Workspaces</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {visible.length} of {tenants.length} shown
            </p>
          </div>
          <label className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, slug, owner…"
              className="w-64 rounded-full border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 px-6 pt-4">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                filter === f.key
                  ? 'bg-brand text-white'
                  : 'border border-line bg-card text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="divide-y divide-line">
          {visible.slice(0, 8).map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/superadmin/tenants/${t.id}`}
              className="flex items-center gap-4 px-6 py-4 transition hover:bg-surface"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-base font-bold text-brand">
                {t.name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">{t.name}</span>
                <span className="block truncate text-xs text-muted">
                  /{t.slug} · {t.subscription?.plan.name ?? 'No plan'} · {t.owner.email}
                </span>
              </span>
              <TenantStatusBadge status={t.status} />
              <span className="hidden w-24 shrink-0 text-right text-xs text-muted sm:block">
                {new Date(t.createdAt).toLocaleDateString()}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          ))}
          {visible.length === 0 && (
            <p className="px-6 py-12 text-center text-sm text-muted">
              No workspaces match. Try a different search or filter.
            </p>
          )}
        </div>
        {visible.length > 8 && (
          <Link
            href="/dashboard/superadmin/tenants"
            className="flex items-center justify-center gap-1.5 border-t border-line px-6 py-3.5 text-sm font-semibold text-brand hover:bg-surface"
          >
            View all {visible.length} workspaces <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </section>

      {/* Quick actions */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: '/dashboard/superadmin/tenants', icon: Building2, title: 'Sub-accounts', body: 'Create, suspend, brand, and domain-manage workspaces.' },
          { href: '/dashboard/superadmin/plans', icon: CreditCard, title: 'Plans & billing', body: 'Price the subscriptions workspaces pay you.' },
          { href: '/dashboard/admin/admins', icon: Users, title: 'Platform staff', body: 'Admins, roles, and workspace assignments.' },
          { href: '/dashboard/admin/settings/payment', icon: Wallet, title: 'Payment gateways', body: 'Razorpay keys for course checkout, without a redeploy.' },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="group rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <q.icon className="h-5 w-5 text-brand" />
            <h3 className="mt-3 font-bold text-ink">{q.title}</h3>
            <p className="mt-1 text-sm text-muted">{q.body}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">
              Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>
    </SuperAdminShell>
  );
}

function daypart(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
