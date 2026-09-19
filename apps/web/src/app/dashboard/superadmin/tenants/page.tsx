'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { StatusBadge } from '../page';
import type { PlanRow, TenantRow } from '@/lib/types';

export default function TenantsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard/superadmin" className="text-sm text-muted hover:text-brand">← Superadmin</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Tenants</h1>
      <p className="mt-1 text-muted">Every tenant is a fully isolated white-label workspace, sold on a plan.</p>

      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="card mt-6 divide-y divide-line">
        {tenants.length === 0 && <div className="p-8 text-center text-muted">No tenants yet.</div>}
        {tenants.map((t) => (
          <Link key={t.id} href={`/dashboard/superadmin/tenants/${t.id}`} className="flex items-center gap-4 p-5 hover:bg-brand-soft/40">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft font-semibold text-brand">{t.name[0]}</div>
            <div className="flex-1">
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-muted">{t.owner.email} · {t.subscription?.plan.name ?? 'no plan'}</div>
            </div>
            <StatusBadge status={t.status} />
          </Link>
        ))}
      </div>

      <form onSubmit={create} className="card mt-8 space-y-4 p-6">
        <h2 className="font-bold">Sell a new tenant</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input required className="input" placeholder="Tenant / brand name" value={form.tenantName} onChange={(e) => setForm((f) => ({ ...f, tenantName: e.target.value }))} />
          <select required className="input" value={form.planId} onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}>
            {plans.length === 0 && <option value="">No plans — create one first</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — ${(p.priceMonthly / 100).toFixed(2)}/mo</option>
            ))}
          </select>
          <input required className="input" placeholder="Admin name" value={form.adminName} onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))} />
          <input required type="email" className="input" placeholder="Admin email" value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} />
          <input required type="password" minLength={8} className="input" placeholder="Admin password (min 8)" value={form.adminPassword} onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))} />
        </div>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <button disabled={busy || plans.length === 0} className="btn-primary">{busy ? 'Creating…' : 'Create tenant'}</button>
      </form>
    </div>
  );
}
