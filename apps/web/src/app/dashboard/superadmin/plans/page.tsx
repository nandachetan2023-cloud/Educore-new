'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';
import type { PlanRow } from '@/lib/types';

export default function PlansPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', priceMonthly: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<PlanRow[]>('/admin/plans').then(setPlans).catch(() => setPlans([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard/superadmin/plans'); return; }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') { router.push('/dashboard'); return; }
    load();
  }, [user, authLoading]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null); setBusy(true);
    try {
      const priceMonthly = Math.round(Number(form.priceMonthly) * 100);
      await api('/admin/plans', { method: 'POST', body: JSON.stringify({ name: form.name, priceMonthly }) });
      setForm({ name: '', priceMonthly: '' });
      setMsg('Plan created.');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to create plan');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: PlanRow) => {
    try {
      await api(`/admin/plans/${p.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !p.isActive }) });
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed');
    }
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <SuperAdminShell>
      <Link href="/dashboard/superadmin" className="flex items-center gap-1.5 text-sm text-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Superadmin
      </Link>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">Plans</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-muted">
        What you sell tenants. A Stripe Product/Price is created (or updated) automatically when
        <code className="mx-1 rounded bg-line px-1.5 py-0.5 text-xs">STRIPE_SECRET_KEY</code>
        is configured; without it, plans still work for manual tenant assignment.
      </p>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{err}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {plans.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center text-sm text-muted sm:col-span-2">
            No plans yet.
          </div>
        )}
        {plans.map((p) => (
          <div key={p.id} className="rounded-2xl border border-line bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <CreditCard className="h-5 w-5" />
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.isActive ? 'bg-green-500/10 text-green-600' : 'bg-slate-500/10 text-slate-500'}`}>
                {p.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink">{p.name}</h3>
            <p className="text-sm text-muted">${(p.priceMonthly / 100).toFixed(2)}/mo · {p.currency.toUpperCase()}</p>
            <button onClick={() => toggleActive(p)} className="btn-ghost mt-4 rounded-full px-5 py-2 text-sm">
              {p.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-ink">Add a plan</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Plan name</label>
            <input required className="input" placeholder="Growth" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Price / month (USD)</label>
            <input required type="number" min="0" step="0.01" className="input" placeholder="49.00" value={form.priceMonthly} onChange={(e) => setForm((f) => ({ ...f, priceMonthly: e.target.value }))} />
          </div>
        </div>
        {msg && <p className="mt-3 text-sm font-medium text-green-600">{msg}</p>}
        <button disabled={busy} className="btn-primary mt-4 rounded-full px-8">
          <Plus className="h-4 w-4" /> {busy ? 'Creating…' : 'Create plan'}
        </button>
      </form>
    </SuperAdminShell>
  );
}
