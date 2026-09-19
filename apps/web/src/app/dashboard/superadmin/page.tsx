'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, BarChart3, Building2, ChevronRight, CreditCard, LayoutDashboard, Palette, Plus, Settings, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { LineChart } from '@/components/charts';
import { TenantStatusBadge } from '@/components/tenant-status-badge';
import type { TenantRow } from '@/lib/types';

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function SuperadminOverview() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[] | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard/superadmin'); return; }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') { router.push('/dashboard'); return; }
    api<TenantRow[]>('/admin/tenants').then(setTenants).catch(() => setTenants([]));
  }, [user, authLoading, router]);

  const stats = useMemo(() => {
    const rows = tenants ?? [];
    return {
      mrr: rows.reduce((n, t) => n + (t.status === 'active' ? (t.subscription?.plan.priceMonthly ?? 0) : 0), 0),
      active: rows.filter((t) => t.status === 'active').length,
      pending: rows.filter((t) => t.status === 'pending_setup').length,
      attention: rows.filter((t) => t.status === 'past_due' || t.status === 'suspended').length,
    };
  }, [tenants]);
  if (authLoading || tenants === null) return <div className="container-page py-20 text-center text-muted">Loading…</div>;
  const growth = tenants.slice(0, 8).reverse().map((t, i) => ({ label: t.name, value: i + 1 }));

  return <div className="min-h-[calc(100vh-68px)] bg-[#f7f9fb] text-slate-900">
    <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[220px_1fr]">
      <aside className="hidden min-h-[calc(100vh-68px)] bg-slate-950 px-3 py-7 text-slate-300 lg:block">
        <div className="px-3 pb-8"><p className="text-lg font-black text-white">Partner Portal</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Global admin</p></div>
        <nav className="space-y-1"><SideLink active href="/dashboard/superadmin" icon={<LayoutDashboard size={18} />} label="Dashboard" /><SideLink href="/dashboard/superadmin/tenants" icon={<Building2 size={18} />} label="Sub-accounts" /><SideLink href="/dashboard/superadmin/plans" icon={<CreditCard size={18} />} label="Plans" /><SideLink href="/dashboard/admin/branding" icon={<Palette size={18} />} label="Branding" /><SideLink href="/dashboard/admin/admins" icon={<Users size={18} />} label="Account" /></nav>
        <div className="mt-12 border-t border-white/10 px-3 pt-5 text-xs text-slate-500">Signed in as<br /><span className="font-medium text-slate-200">{user?.name ?? 'Admin user'}</span></div>
      </aside>
      <main className="min-w-0 px-4 py-7 sm:px-7 lg:px-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-medium text-blue-700">Platform operations</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">Partner Dashboard</h1></div><div className="flex gap-2"><Link href="/dashboard/superadmin/tenants" className="btn-primary inline-flex items-center gap-2"><Plus size={17} /> Create sub-account</Link><Link href="/dashboard/admin/branding" className="btn-ghost"><Settings size={17} /></Link></div></header>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi icon={<CreditCard size={19} />} label="Monthly recurring revenue" value={money.format(stats.mrr / 100)} detail="Across active subscriptions" tone="blue" /><Kpi icon={<Building2 size={19} />} label="Active sub-accounts" value={String(stats.active)} detail={`${tenants.length} total workspaces`} tone="slate" /><Kpi icon={<Users size={19} />} label="Pending setup" value={String(stats.pending)} detail="Awaiting account activation" tone="violet" /><Kpi icon={<AlertCircle size={19} />} label="Needs attention" value={String(stats.attention)} detail="Past due or suspended" tone="red" /></section>
        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-2"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="font-bold">Recent sub-account activity</h2><p className="mt-1 text-sm text-slate-500">Latest workspaces created on the platform.</p></div><Link href="/dashboard/superadmin/tenants" className="text-sm font-semibold text-blue-700">View all</Link></div><div className="divide-y divide-slate-100">{tenants.slice(0, 5).map((tenant) => <Link key={tenant.id} href={`/dashboard/superadmin/tenants/${tenant.id}`} className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50"><div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">{tenant.name[0]}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{tenant.name}</p><p className="truncate text-xs text-slate-500">{tenant.subscription?.plan.name ?? 'No plan'} · {tenant.owner.email}</p></div><TenantStatusBadge status={tenant.status} /><span className="hidden text-xs text-slate-400 sm:block">{new Date(tenant.createdAt).toLocaleDateString()}</span><ChevronRight size={17} className="text-slate-400" /></Link>)}{tenants.length === 0 && <p className="px-6 py-12 text-center text-sm text-slate-500">No sub-accounts yet. Create your first workspace to get started.</p>}</div></div>
          <div className="space-y-6"><div className="overflow-hidden rounded-xl bg-blue-700 p-6 text-white"><Palette size={27} className="text-blue-200" /><h2 className="mt-8 text-xl font-bold">Brand settings</h2><p className="mt-2 text-sm leading-6 text-blue-100">Customize the identity customers see across your learning platform.</p><Link href="/dashboard/admin/branding" className="mt-6 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-blue-700">Customize UI</Link></div><div className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Quick actions</h2><QuickLink href="/dashboard/superadmin/tenants" icon={<Building2 size={17} />} label="Manage sub-accounts" /><QuickLink href="/dashboard/superadmin/plans" icon={<CreditCard size={17} />} label="Manage plans" /><QuickLink href="/dashboard/admin/admins" icon={<Users size={17} />} label="Platform staff" /></div></div>
        </section>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-start justify-between"><div><h2 className="font-bold">Workspace growth</h2><p className="mt-1 text-sm text-slate-500">Cumulative view of recently created workspaces.</p></div><BarChart3 size={20} className="text-blue-600" /></div><div className="mt-5 text-blue-600"><LineChart data={growth} height={150} color="#2563eb" /></div></section>
      </main>
    </div>
  </div>;
}

function SideLink({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) { return <Link href={href} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${active ? 'bg-blue-600 text-white' : 'hover:bg-white/10 hover:text-white'}`}>{icon}{label}</Link>; }
function Kpi({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: 'blue' | 'slate' | 'violet' | 'red' }) { const tones = { blue: 'bg-blue-50 text-blue-700', slate: 'bg-slate-100 text-slate-700', violet: 'bg-violet-50 text-violet-700', red: 'bg-red-50 text-red-700' }; return <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between"><p className="text-sm font-semibold text-slate-500">{label}</p><span className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</span></div><p className="mt-5 text-3xl font-extrabold tracking-tight">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>; }
function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) { return <Link href={href} className="mt-3 flex items-center gap-3 rounded-lg p-2 text-sm font-medium transition hover:bg-slate-50"><span className="text-slate-500">{icon}</span><span className="flex-1">{label}</span><ChevronRight size={16} className="text-slate-400" /></Link>; }
