'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AuditLogEntry } from '@/lib/types';

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (action) params.set('action', action);
      if (entity) params.set('entity', entity);
      if (search) params.set('q', search);
      const data = await api<{ items?: AuditLogEntry[]; total?: number }>(`/admin/audit-logs/mine?${params.toString()}`);
      setLogs(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setLogs([]);
      setTotal(0);
      setError(e instanceof ApiError ? `${e.message} (HTTP ${e.status})` : 'Could not load the activity logs');
    } finally {
      setLoading(false);
    }
  }

  // Debounce the free-text search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { load(); }, [page, action, entity, search]);

  return (
    <div className="p-6 space-y-6" style={{ fontFamily: 'var(--font-admin-body)' }}>
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin" className="text-ink/60 hover:text-ink">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-ink">Activity logs</h1>
      </div>

      <div className="rounded-2xl border border-[#EAE6DB] bg-white p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/30" />
          <input
            type="search"
            placeholder="Search actor, entity, action…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#EAE6DB] bg-white text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-[#EAE6DB] bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">All actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>
          <select
            value={entity}
            onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-[#EAE6DB] bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">All entities</option>
            <option value="user">User</option>
            <option value="course">Course</option>
            <option value="category">Category</option>
            <option value="order">Order</option>
            <option value="coupon">Coupon</option>
            <option value="certificate">Certificate</option>
            <option value="content">Content</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-[#EAE6DB] bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F9F7F4] border-b border-[#EAE6DB]">
            <tr>
              <th className="p-3 text-left font-semibold text-ink/70">Time</th>
              <th className="p-3 text-left font-semibold text-ink/70">Actor</th>
              <th className="p-3 text-left font-semibold text-ink/70">Action</th>
              <th className="p-3 text-left font-semibold text-ink/70">Entity</th>
              <th className="p-3 text-left font-semibold text-ink/70">Entity ID</th>
              <th className="p-3 text-left font-semibold text-ink/70">Tenant</th>
              <th className="p-3 text-left font-semibold text-ink/70">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-ink/40">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="p-6 text-center text-red-500">{error}</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-ink/40">No activity logs yet</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-[#EAE6DB] hover:bg-[#F9F7F4]">
                  <td className="p-3 text-ink/60">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="p-3 text-ink">{log.actorName ?? '—'} <span className="text-ink/40 text-xs">({log.actorEmail})</span></td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
                      {log.action === 'create' ? 'bg-green-100 text-green-700' :
                       log.action === 'update' ? 'bg-blue-100 text-blue-700' :
                       log.action === 'delete' ? 'bg-red-100 text-red-700' :
                       'bg-gray-100 text-gray-700'}">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-ink/70 capitalize">{log.entity}</td>
                  <td className="p-3 font-mono text-ink/60">{log.entityId}</td>
                  <td className="p-3 text-ink/50 font-mono text-xs">{log.tenantId ?? '—'}</td>
                  <td className="p-3 text-ink/50 font-mono">{log.ipAddress ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {total > 25 && (
          <div className="p-3 border-t border-[#EAE6DB] flex items-center justify-between">
            <span className="text-sm text-ink/60">
              Page {page} of {Math.ceil(total / 25)} — {total} total
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-[#EAE6DB] bg-white text-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F9F7F4]"
              >
                Previous
              </button>
              <button
                disabled={page >= Math.ceil(total / 25)}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-[#EAE6DB] bg-white text-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F9F7F4]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}