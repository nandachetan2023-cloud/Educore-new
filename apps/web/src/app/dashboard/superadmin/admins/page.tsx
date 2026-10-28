'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Palette, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';

interface StaffRow {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'super_admin';
  image?: string | null;
  tenantId: number | null;
  createdAt: string;
  tenant?: { id: number; name: string; slug: string } | null;
}

interface TenantOption {
  id: number;
  name: string;
  slug: string;
}

export default function PlatformStaffPage() {
  const { user, loading } = useAuth();
  const r = useRouter();

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [q, setQ] = useState('');
  const [fetching, setFetching] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' as 'admin' | 'super_admin', tenantId: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [workspaceFor, setWorkspaceFor] = useState<StaffRow | null>(null);
  const [workspacePick, setWorkspacePick] = useState<string>('');

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3400);
  };

  const load = () => {
    Promise.all([
      api<StaffRow[]>('/admin/admins').catch(() => []),
      api<TenantOption[]>('/admin/tenants').catch(() => []),
    ]).then(([s, t]) => {
      setStaff(s);
      setTenants(t.map((x) => ({ id: x.id, name: x.name, slug: x.slug })));
      setFetching(false);
    });
  };

  useEffect(() => {
    if (loading) return;
    if (!user || user.principal !== 'admin' || user.adminRole !== 'super_admin') {
      r.push('/login?next=/dashboard/superadmin/admins');
      return;
    }
    load();
  }, [user, loading, r]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          ...(form.tenantId ? { tenantId: Number(form.tenantId) } : {}),
        }),
      });
      setCreateOpen(false);
      setForm({ name: '', email: '', password: '', role: 'admin', tenantId: '' });
      showToast('Admin created.');
      load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to create admin');
    } finally {
      setBusy(false);
    }
  };

  const assignWorkspace = async () => {
    if (!workspaceFor) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/admins/${workspaceFor.id}/tenant`, {
        method: 'PUT',
        body: JSON.stringify({ tenantId: workspacePick ? Number(workspacePick) : null }),
      });
      setWorkspaceFor(null);
      showToast('Workspace assignment saved.');
      load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to assign workspace');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: StaffRow) => {
    if (!confirm(`Delete admin ${s.name}?`)) return;
    try {
      await api(`/admin/admins/${s.id}`, { method: 'DELETE' });
      showToast('Admin removed.');
      load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to delete admin');
    }
  };

  const filtered = staff.filter((s) =>
    `${s.name} ${s.email} ${s.role} ${s.tenant?.name ?? ''}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <SuperAdminShell>
      <div className="container-page py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">Platform Staff</h1>
            <p className="text-muted">
              Create admins, attach them to white-label workspaces, change roles, and remove accounts.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" /> New admin
          </button>
        </div>

        {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-600">{err}</p>}

        <div className="mt-6 card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, role, workspace…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-surface text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 text-left">Admin</th>
                  <th className="px-5 py-3 text-left">Role</th>
                  <th className="px-5 py-3 text-left">White-label workspace</th>
                  <th className="px-5 py-3 text-left">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fetching && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-muted">Loading…</td></tr>
                )}
                {!fetching && filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-surface">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                          {s.name?.[0]?.toUpperCase() ?? 'A'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{s.name}</p>
                          <p className="truncate text-xs text-muted">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ${s.role === 'super_admin' ? 'bg-brand text-white' : 'bg-slate-500/10 text-slate-600'}`}>
                        {s.role === 'super_admin' ? 'Super admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {s.tenant ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <Palette className="h-3 w-3" /> {s.tenant.name} (/{s.tenant.slug})
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Platform (no tenant)</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-2 text-xs font-semibold">
                        <button
                          onClick={() => {
                            setWorkspaceFor(s);
                            setWorkspacePick(s.tenantId ? String(s.tenantId) : '');
                          }}
                          className="rounded-lg bg-surface px-3 py-1.5 text-ink transition hover:bg-brand-soft hover:text-brand"
                        >
                          {s.tenant ? 'Change workspace' : 'Assign workspace'}
                        </button>
                        <button
                          onClick={() => remove(s)}
                          disabled={s.email === user?.email}
                          title={s.email === user?.email ? 'You cannot delete your own account' : 'Delete admin'}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!fetching && filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-muted">No admins match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          Branding, custom domain and colours for an assigned workspace live under{' '}
          <Link href="/dashboard/superadmin/tenants" className="font-semibold text-brand hover:underline">Sub-accounts</Link>{' '}
          and{' '}
          <Link href="/dashboard/superadmin/white-label" className="font-semibold text-brand hover:underline">White label</Link>.
        </p>
      </div>

      {/* Create admin modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-5">
              <h2 className="text-lg font-bold text-ink">Create admin</h2>
              <button onClick={() => setCreateOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={create} className="space-y-4 p-5">
              <div>
                <label className="label">Full name</label>
                <input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Admin" />
              </div>
              <div>
                <label className="label">Email</label>
                <input required type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@brand.com" />
              </div>
              <div>
                <label className="label">Password (min 8 chars)</label>
                <input required minLength={8} type="password" className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'super_admin' }))}>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super admin</option>
                  </select>
                </div>
                <div>
                  <label className="label">White-label workspace</label>
                  <select className="input" value={form.tenantId} onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}>
                    <option value="">None (platform)</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="rounded-xl bg-surface p-3 text-xs text-muted">
                A workspace admin gets that tenant&apos;s branding, custom domain and content only. Super admin
                must be platform-level (no workspace).
              </p>
              <div className="flex justify-end gap-2.5 border-t border-line pt-4">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-muted hover:text-ink">
                  Cancel
                </button>
                <button disabled={busy} className="btn-primary rounded-xl px-6 py-2.5 text-sm disabled:opacity-60">
                  {busy ? 'Creating…' : 'Create admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign workspace modal */}
      {workspaceFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setWorkspaceFor(null)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-5">
              <h2 className="text-lg font-bold text-ink">Assign workspace — {workspaceFor.name}</h2>
              <button onClick={() => setWorkspaceFor(null)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="label">White-label workspace</label>
                <select className="input" value={workspacePick} onChange={(e) => setWorkspacePick(e.target.value)}>
                  <option value="">None (platform-level)</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2.5 border-t border-line pt-4">
                <button onClick={() => setWorkspaceFor(null)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-muted hover:text-ink">
                  Cancel
                </button>
                <button onClick={assignWorkspace} disabled={busy} className="btn-primary rounded-xl px-6 py-2.5 text-sm disabled:opacity-60">
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex max-w-sm items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-2xl">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
          <span className="break-words">{toast}</span>
        </div>
      )}
    </SuperAdminShell>
  );
}
