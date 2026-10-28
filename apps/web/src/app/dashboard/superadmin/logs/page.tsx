'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';

interface AuditRow {
  id: number;
  actorType: 'admin' | 'user' | 'system';
  actorName?: string;
  actorRole?: string;
  action: string;
  entity?: string;
  entityId?: number;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

const ACTION_TONE: { prefix: string; cls: string }[] = [
  { prefix: 'auth.login', cls: 'bg-green-500/15 text-green-600' },
  { prefix: 'coupon.blocked', cls: 'bg-red-500/15 text-red-500' },
  { prefix: 'tenant.suspend', cls: 'bg-red-500/15 text-red-500' },
  { prefix: 'coupon.create', cls: 'bg-violet-500/15 text-violet-600' },
  { prefix: 'reseller', cls: 'bg-amber-500/15 text-amber-600' },
];

function tone(action: string): string {
  return ACTION_TONE.find((t) => action.startsWith(t.prefix))?.cls ?? 'bg-brand-soft text-brand';
}

export default function LogsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin' || user.adminRole !== 'super_admin') {
      router.push('/login?next=/dashboard/superadmin/logs');
      return;
    }
    load();
  }, [user, authLoading]);

  const load = useCallback(() => {
    api<AuditRow[]>('/admin/audit-logs?take=150').then(setRows).catch(() => setRows([]));
  }, []);

  const visible = (rows ?? []).filter((r) =>
    q ? `${r.action} ${r.actorName ?? ''} ${r.actorRole ?? ''}`.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <SuperAdminShell>
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Audit logs</h1>
            <p className="mt-1 text-[15px] text-muted">Who did what, when — logins, suspensions, plan & domain changes, coupons, blocked attempts.</p>
          </div>
          <label className="relative flex items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by action, actor…"
              className="w-64 rounded-full border border-line bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className="block font-semibold text-ink">{r.actorName ?? 'System'}</span>
                    <span className="block text-[11px] text-muted">{r.actorRole ?? r.actorType}</span>
                  </td>
                  <td className="px-5 py-3"><span className={`badge ${tone(r.action)}`}>{r.action}</span></td>
                  <td className="px-5 py-3 text-xs text-muted">{r.entity}{r.entityId ? ` #${r.entityId}` : ''}</td>
                  <td className="max-w-[280px] truncate px-5 py-3 text-xs text-muted">
                    {r.meta ? JSON.stringify(r.meta) : '—'}
                    {r.ip ? ` · ${r.ip}` : ''}
                  </td>
                </tr>
              ))}
              {rows?.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">No audit events recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </SuperAdminShell>
  );
}
