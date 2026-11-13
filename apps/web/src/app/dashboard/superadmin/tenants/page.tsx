'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Search, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';
import { TenantStatusBadge } from '@/components/tenant-status-badge';
import type { TenantRow } from '@/lib/types';

export default function TenantsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    api<TenantRow[]>('/admin/tenants')
      .then(setTenants)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard/superadmin/tenants'); return; }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') { router.push('/dashboard'); return; }
    load();
  }, [user, authLoading]);

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

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Building2 className="h-5 w-5 text-brand" /> Sell a new tenant</h2>
          <p className="mt-1 text-sm text-muted">Create the workspace and owner, then configure its authentication and verify payment integration in one flow.</p>
        </div>
        <Link href="/dashboard/superadmin/setup-wizard" className="btn-primary rounded-full px-6">
          <ShieldCheck className="h-4 w-4" /> Start tenant setup
        </Link>
      </section>
    </SuperAdminShell>
  );
}
