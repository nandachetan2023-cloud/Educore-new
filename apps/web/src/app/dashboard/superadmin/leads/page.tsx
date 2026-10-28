'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';

interface Lead {
  id: number; name: string; email: string; company?: string; phone?: string;
  message?: string; source: string; status: 'new' | 'contacted' | 'converted' | 'closed'; createdAt: string;
}

const STATUSES: Lead['status'][] = ['new', 'contacted', 'converted', 'closed'];

const STATUS_STYLE: Record<Lead['status'], string> = {
  new: 'bg-blue-500/15 text-blue-600',
  contacted: 'bg-amber-500/15 text-amber-600',
  converted: 'bg-green-500/15 text-green-600',
  closed: 'bg-gray-500/15 text-gray-500',
};

export default function LeadsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [filter, setFilter] = useState<'all' | Lead['status']>('all');

  const load = useCallback(() => {
    api<Lead[]>(`/admin/leads${filter !== 'all' ? `?status=${filter}` : ''}`).then(setRows).catch(() => setRows([]));
  }, [filter]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin' || user.adminRole !== 'super_admin') {
      router.push('/login?next=/dashboard/superadmin/leads');
      return;
    }
    load();
  }, [user, authLoading, load]);

  const setStatus = async (id: number, status: Lead['status']) => {
    await api(`/admin/leads/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  };

  return (
    <SuperAdminShell>
      <div className="container-page">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Leads</h1>
        <p className="mt-1 text-[15px] text-muted">Trial requests and contact-form submissions from the marketing website.</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(['all', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize transition ${
                filter === s ? 'bg-brand text-white' : 'border border-line bg-card text-muted hover:text-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Lead</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Message</th>
                <th className="px-5 py-3">Received</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(rows ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-4">
                    <span className="block font-bold text-ink">{l.name}</span>
                    <span className="block text-xs text-muted">{l.email}{l.company ? ` · ${l.company}` : ''}{l.phone ? ` · ${l.phone}` : ''}</span>
                  </td>
                  <td className="px-5 py-4"><span className="badge bg-brand-soft text-brand capitalize">{l.source}</span></td>
                  <td className="max-w-[280px] truncate px-5 py-4 text-muted">{l.message || '—'}</td>
                  <td className="px-5 py-4 text-xs text-muted">{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <select
                      value={l.status}
                      onChange={(e) => setStatus(l.id, e.target.value as Lead['status'])}
                      className={`rounded-full px-3 py-1 text-[12px] font-semibold ${STATUS_STYLE[l.status]} bg-card`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s} className="text-ink">{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {rows?.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">No leads{filter !== 'all' ? ' with this status' : ' yet'}.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </SuperAdminShell>
  );
}
