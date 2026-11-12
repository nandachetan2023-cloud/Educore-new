'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderTree, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';

interface Category {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  image?: string | null;
  status?: boolean | null;
  parentId?: number | null;
  _count?: { courses: number };
}

export default function AdminCategoriesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const load = () => {
    api<Category[]>('/categories')
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') {
      router.push('/login?next=/dashboard/admin/categories');
      return;
    }
    load();
  }, [user, authLoading, router]);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await api('/categories', { method: 'POST', body: JSON.stringify({ name, status: true }) });
      setNewName('');
      setMsg(`"${name}" created`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the category');
    } finally {
      setBusy(false);
    }
  };

  const rename = async (c: Category) => {
    const name = editName.trim();
    if (!name || name === c.name) { setEditing(null); return; }
    setBusy(true);
    setError(null);
    try {
      await api(`/categories/${c.id}`, { method: 'PUT', body: JSON.stringify({ name, status: c.status ?? true }) });
      setEditing(null);
      setMsg(`"${name}" updated`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the category');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete "${c.name}"? Courses in this category will be left without one.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/categories/${c.id}`, { method: 'DELETE' });
      setMsg(`"${c.name}" deleted`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete the category');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) {
    return <div className="container-page py-20 text-center text-muted">Loading…</div>;
  }

  return (
    <DirectoryShell
      eyebrow="Admin Console"
      sections={[
        {
          heading: 'Catalog',
          links: [
            { href: '/dashboard/admin', label: 'Overview', icon: FolderTree },
            { href: '/dashboard/admin/categories', label: 'Categories', icon: FolderTree },
            { href: '/dashboard/admin/users', label: 'Users & Directory', icon: FolderTree },
            { href: '/dashboard/admin/coupons', label: 'Coupons', icon: FolderTree },
          ],
        },
      ]}
      userName={user?.name ?? 'Admin'}
      userCaption="Tenant admin"
      userImage={user?.image}
      onLogout={logout}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-semibold tracking-tight text-ink">Categories</h1>
          <p className="text-sm text-muted">Course categories used across the catalog and the course builder</p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <input
          className="input max-w-xs"
          placeholder="New category name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), create())}
        />
        <button onClick={create} disabled={busy || !newName.trim()} className="btn-primary">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>}
      {msg && !error && <p className="mt-4 rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-600">{msg}</p>}

      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {categories.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted">No categories yet — add your first one above.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3.5 font-semibold">Category</th>
                <th className="px-5 py-3.5 font-semibold">Slug</th>
                <th className="px-5 py-3.5 font-semibold">Courses</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {categories.map((c) => (
                <tr key={c.id} className="transition hover:bg-surface">
                  <td className="px-5 py-3.5 font-semibold text-ink">
                    {editing === c.id ? (
                      <input
                        autoFocus
                        className="input !py-1.5"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), rename(c))}
                        onBlur={() => rename(c)}
                      />
                    ) : (
                      c.name
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-muted">{c.slug}</td>
                  <td className="px-5 py-3.5 text-muted">{c._count?.courses ?? 0}</td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${c.status === false ? 'bg-amber-500/10 text-amber-600' : 'bg-green-500/10 text-green-600'}`}>
                      {c.status === false ? 'Hidden' : 'Visible'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditing(c.id); setEditName(c.name); }}
                        className="rounded-full border border-line p-2 text-muted transition hover:border-brand hover:text-brand"
                        title="Rename"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        disabled={busy}
                        className="rounded-full border border-line p-2 text-muted transition hover:border-red-400 hover:text-red-500 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
        <X className="h-3.5 w-3.5" /> Categories deleted with courses attached are blocked by the API — move those courses first.
      </p>
    </DirectoryShell>
  );
}
