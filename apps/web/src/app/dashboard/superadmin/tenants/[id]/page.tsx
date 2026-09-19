'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { StatusBadge } from '../../page';
import type { TenantRow } from '@/lib/types';

export default function TenantDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<TenantRow>(`/admin/tenants/${params.id}`).then(setTenant).catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load tenant'));
  }, [params.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(`/login?next=/dashboard/superadmin/tenants/${params.id}`); return; }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') { router.push('/dashboard'); return; }
    load();
  }, [user, authLoading]);

  const toggleSuspend = async () => {
    if (!tenant) return;
    setBusy(true);
    setErr(null);
    try {
      const action = tenant.status === 'suspended' ? 'reactivate' : 'suspend';
      await api(`/admin/tenants/${tenant.id}/${action}`, { method: 'POST' });
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !tenant) return <div className="container-page py-20 text-center text-muted">{err ?? 'Loading…'}</div>;

  return (
    <div className="container-page max-w-2xl py-10">
      <Link href="/dashboard/superadmin/tenants" className="text-sm text-muted hover:text-brand">← Tenants</Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">{tenant.name}</h1>
        <StatusBadge status={tenant.status} />
      </div>
      <p className="mt-1 text-muted">/{tenant.slug}</p>

      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="card mt-6 space-y-3 p-6">
        <Row label="Owner" value={`${tenant.owner.name} (${tenant.owner.email})`} />
        <Row label="Plan" value={tenant.subscription ? `${tenant.subscription.plan.name} — $${(tenant.subscription.plan.priceMonthly / 100).toFixed(2)}/mo` : 'None'} />
        <Row label="Subscription status" value={tenant.subscription?.status ?? 'none'} />
        <Row label="Custom domain" value={tenant.customDomain ?? 'Not set (coming in a later phase)'} />
        <Row label="Created" value={new Date(tenant.createdAt).toLocaleString()} />
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-bold">Access</h2>
        <p className="mt-1 text-sm text-muted">
          Suspending immediately blocks this tenant's admin, instructors, and students from logging in or using
          already-issued sessions — enforced on every request, not just at login.
        </p>
        <button
          onClick={toggleSuspend}
          disabled={busy}
          className={`btn mt-4 px-4 py-2 text-sm text-white hover:brightness-110 ${tenant.status === 'suspended' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {busy ? 'Working…' : tenant.status === 'suspended' ? 'Reactivate tenant' : 'Suspend tenant'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
