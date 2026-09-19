'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
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
    <div className="container-page max-w-2xl py-10">
      <Link href="/dashboard/superadmin" className="text-sm text-muted hover:text-brand">← Superadmin</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Plans</h1>
      <p className="mt-1 text-muted">
        What you sell tenants. Stripe Product/Price sync isn't wired up yet — plans work today for manual tenant
        assignment; real recurring billing lands in a later phase.
      </p>

      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="card mt-6 divide-y divide-line">
        {plans.length === 0 && <div className="p-8 text-center text-muted">No plans yet.</div>}
        {plans.map((p) => (
          <div key={p.id} className="flex items-center gap-4 p-5">
            <div className="flex-1">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-muted">${(p.priceMonthly / 100).toFixed(2)}/mo · {p.currency.toUpperCase()}</div>
            </div>
            <span className={`badge ${p.isActive ? 'bg-green-500/15 text-green-600' : 'bg-gray-500/15 text-gray-500'}`}>
              {p.isActive ? 'Active' : 'Inactive'}
            </span>
            <button onClick={() => toggleActive(p)} className="btn-ghost px-3 py-2 text-sm">
              {p.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="card mt-8 space-y-4 p-6">
        <h2 className="font-bold">Add a plan</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input required className="input" placeholder="Plan name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input required type="number" min="0" step="0.01" className="input" placeholder="Price / month (USD)" value={form.priceMonthly} onChange={(e) => setForm((f) => ({ ...f, priceMonthly: e.target.value }))} />
        </div>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <button disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create plan'}</button>
      </form>
    </div>
  );
}
