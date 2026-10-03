'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { TenantRow } from '@/lib/types';

interface AdminRow { id: number; name: string; email: string; role: 'admin' | 'super_admin'; tenantId: number | null; tenant?: { id: number; name: string; slug: string } | null; createdAt: string }

export default function AdminsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' as 'admin' | 'super_admin', tenantId: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<AdminRow[]>('/admin/admins').then(setAdmins).catch(() => setAdmins([])).finally(() => setLoading(false));
    api<TenantRow[]>('/admin/tenants').then(setTenants).catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/admins'); return; }
    if (user.adminRole !== 'super_admin') { router.push('/dashboard/admin'); return; }
    load();
  }, [user, authLoading]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      await api('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          tenantId: form.tenantId ? Number(form.tenantId) : null,
        }),
      });
      setForm({ name: '', email: '', password: '', role: 'admin', tenantId: '' });
      setMsg('Admin created.'); load();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed to create admin'); }
  };

  const setTenant = async (a: AdminRow, tenantId: string) => {
    try {
      await api(`/admin/admins/${a.id}/tenant`, {
        method: 'PUT',
        body: JSON.stringify({ tenantId: tenantId ? Number(tenantId) : null }),
      });
      load();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed to assign workspace'); }
  };

  const toggleRole = async (a: AdminRow) => {
    const next = a.role === 'super_admin' ? 'admin' : 'super_admin';
    try { await api(`/admin/admins/${a.id}/role`, { method: 'POST', body: JSON.stringify({ role: next }) }); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed'); }
  };

  const remove = async (a: AdminRow) => {
    if (!confirm(`Delete admin ${a.email}?`)) return;
    try { await api(`/admin/admins/${a.id}`, { method: 'DELETE' }); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed'); }
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Admins</h1>
      <p className="mt-1 text-muted">Super-admins can create, promote, and remove admin accounts.</p>

      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="card mt-6 divide-y divide-line">
        {admins.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-4 p-5">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft font-semibold text-brand">{a.name[0]}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{a.name}</span>
                {a.role === 'super_admin'
                  ? <span className="badge bg-brand text-white">Super-admin</span>
                  : <span className="badge">Admin</span>}
                {a.id === user?.id && <span className="text-xs text-muted">(you)</span>}
                {a.tenant
                  ? <Link href={`/dashboard/superadmin/tenants/${a.tenant.id}`} className="badge bg-brand-soft text-brand hover:underline">{a.tenant.name}</Link>
                  : <span className="badge">Platform</span>}
              </div>
              <div className="text-sm text-muted">{a.email}</div>
              {a.role === 'admin' && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <label className="text-muted">White-label workspace:</label>
                  <select
                    className="input max-w-[220px] py-1 text-xs"
                    value={a.tenantId ? String(a.tenantId) : ''}
                    onChange={(e) => setTenant(a, e.target.value)}
                  >
                    <option value="">Platform (no tenant)</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
                    ))}
                  </select>
                  {a.tenantId && (
                    <Link href={`/dashboard/superadmin/tenants/${a.tenantId}`} className="text-brand hover:underline">
                      Edit white label →
                    </Link>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleRole(a)} className="btn-ghost px-3 py-2 text-sm">
                {a.role === 'super_admin' ? 'Demote' : 'Promote'}
              </button>
              {a.id !== user?.id && (
                <button onClick={() => remove(a)} className="btn border border-line px-3 py-2 text-sm text-red-500 hover:bg-red-500/10">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="card mt-8 space-y-4 p-6">
        <h2 className="font-bold">Add an admin</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input required className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input required type="email" className="input" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input required type="password" minLength={8} className="input" placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'super_admin' }))}>
            <option value="admin">Admin</option>
            <option value="super_admin">Super-admin</option>
          </select>
          <select
            className="input sm:col-span-2"
            value={form.tenantId}
            onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
            disabled={form.role === 'super_admin'}
          >
            <option value="">Platform-level (no white-label workspace)</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} (/{t.slug}) — white label applies</option>
            ))}
          </select>
        </div>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <button className="btn-primary">Create admin</button>
      </form>
    </div>
  );
}
