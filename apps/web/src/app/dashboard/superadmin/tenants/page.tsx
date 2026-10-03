'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Plus, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';
import { TenantStatusBadge } from '@/components/tenant-status-badge';
import type { PlanRow, TenantRow } from '@/lib/types';

export default function TenantsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ tenantName: '', adminName: '', adminEmail: '', adminPassword: '', planId: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([api<TenantRow[]>('/admin/tenants'), api<PlanRow[]>('/admin/plans')])
      .then(([t, p]) => {
        setTenants(t);
        setPlans(p);
        setForm((f) => (f.planId ? f : { ...f, planId: p[0] ? String(p[0].id) : '' }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard/superadmin/tenants'); return; }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') { router.push('/dashboard'); return; }
    load();
  }, [user, authLoading]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null); setBusy(true);
    try {
      await api('/admin/tenants', {
        method: 'POST',
        body: JSON.stringify({ ...form, planId: Number(form.planId) }),
      });
      setForm((f) => ({ tenantName: '', adminName: '', adminEmail: '', adminPassword: '', planId: f.planId }));
      setMsg('Tenant created.');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to create tenant');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const visible = tenants.filter((t) =>
    `${t.name} ${t.owner.email}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <SuperAdminShell>
      <Link href="/dashboard/superadmin" className="flex items-center gap-1.5 text-sm text-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Superadmin
      </Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Sub-accounts</h1>
          <p className="mt-1.5 text-[15px] text-muted">Every tenant is a fully isolated white-label workspace, sold on a plan.</p>
        </div>
        <label className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces..."
            className="w-56 rounded-full border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </label>
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{err}</p>}

      <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        {visible.length === 0 && <div className="p-10 text-center text-sm text-muted">No workspaces match.</div>}
        {visible.map((t) => (
          <Link key={t.id} href={`/dashboard/superadmin/tenants/${t.id}`} className="flex items-center gap-4 p-5 transition hover:bg-surface">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft font-bold text-brand">
              {t.name[0]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-ink">{t.name}</span>
              <span className="block truncate text-[13px] text-muted">{t.owner.email} · {t.subscription?.plan.name ?? 'no plan'}</span>
            </span>
            <TenantStatusBadge status={t.status} />
          </Link>
        ))}
      </div>

      <form onSubmit={create} className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Building2 className="h-5 w-5 text-brand" /> Sell a new sub-account</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Workspace / brand name</label>
            <input required className="input" placeholder="Acme Academy" value={form.tenantName} onChange={(e) => setForm((f) => ({ ...f, tenantName: e.target.value }))} />
          </div>
          <div>
            <label className="label">Plan</label>
            <select required className="input" value={form.planId} onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}>
              {plans.length === 0 && <option value="">No plans — create one first</option>}
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — ${(p.priceMonthly / 100).toFixed(2)}/mo</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Admin name</label>
            <input required className="input" placeholder="Jane Owner" value={form.adminName} onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))} />
          </div>
          <div>
            <label className="label">Admin email</label>
            <input required type="email" className="input" placeholder="owner@example.com" value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Admin password (min 8 characters)</label>
            <input required type="password" minLength={8} className="input" placeholder="••••••••" value={form.adminPassword} onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))} />
          </div>
        </div>
        {msg && <p className="mt-3 text-sm font-medium text-green-600">{msg}</p>}
        <button disabled={busy || plans.length === 0} className="btn-primary mt-4 rounded-full px-8">
          <Plus className="h-4 w-4" /> {busy ? 'Creating…' : 'Create sub-account'}
        </button>
      </form>
    </SuperAdminShell>
  );
}
