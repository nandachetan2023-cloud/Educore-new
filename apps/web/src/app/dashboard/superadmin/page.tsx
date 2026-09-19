'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { StatTile } from '@/components/stat-tile';
import type { TenantRow } from '@/lib/types';

export default function SuperadminOverview() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard/superadmin'); return; }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') { router.push('/dashboard'); return; }
    api<TenantRow[]>('/admin/tenants').then(setTenants).catch(() => setTenants([]));
  }, [user, authLoading]);

  if (authLoading || tenants === null) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const active = tenants.filter((t) => t.status === 'active').length;
  const suspended = tenants.filter((t) => t.status === 'suspended').length;
  const pastDue = tenants.filter((t) => t.status === 'past_due').length;
  const mrr = tenants.reduce((sum, t) => sum + (t.status !== 'suspended' ? (t.subscription?.plan.priceMonthly ?? 0) : 0), 0);

  return (
    <div className="container-page py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Superadmin</h1>
          <p className="mt-1 text-muted">Manage tenants and plans across the whole platform.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/superadmin/tenants" className="btn-ghost">Tenants</Link>
          <Link href="/dashboard/superadmin/plans" className="btn-ghost">Plans</Link>
          <Link href="/dashboard/admin/admins" className="btn-ghost">Platform staff</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Tenants" value={tenants.length} />
        <StatTile label="Active" value={active} />
        <StatTile label="Suspended / past due" value={suspended + pastDue} />
        <StatTile label="MRR (approx.)" value={new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(mrr / 100)} />
      </div>

      <div className="card mt-8 divide-y divide-line">
        <div className="p-5 font-bold">Recent tenants</div>
        {tenants.length === 0 && <div className="p-8 text-center text-muted">No tenants yet — create one from the Tenants page.</div>}
        {tenants.slice(0, 5).map((t) => (
          <Link key={t.id} href={`/dashboard/superadmin/tenants/${t.id}`} className="flex items-center gap-4 p-5 hover:bg-brand-soft/40">
            <div className="flex-1">
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-muted">{t.owner.email} · {t.subscription?.plan.name ?? 'no plan'}</div>
            </div>
            <StatusBadge status={t.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: TenantRow['status'] }) {
  const styles: Record<TenantRow['status'], string> = {
    active: 'bg-green-500/15 text-green-600',
    pending_setup: 'bg-amber-500/15 text-amber-600',
    past_due: 'bg-amber-500/15 text-amber-600',
    suspended: 'bg-red-500/15 text-red-600',
  };
  return <span className={`badge ${styles[status]}`}>{status.replace('_', ' ')}</span>;
}
