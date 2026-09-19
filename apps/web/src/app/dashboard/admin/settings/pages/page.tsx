'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

interface CustomPage { id: number; title: string; slug: string; content?: string | null; status: boolean; updatedAt: string }

export default function PageBuilderPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomPage | 'new' | null>(null);

  const load = useCallback(() => {
    api<CustomPage[]>('/admin/pages').then(setPages).catch(() => setPages([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/settings/pages'); return; }
    if (user.adminRole !== 'super_admin') { router.push('/dashboard/admin'); return; }
    load();
  }, [user, authLoading]);

  const remove = async (id: number) => {
    if (!confirm('Delete this page? This cannot be undone.')) return;
    await api(`/admin/pages/${id}`, { method: 'DELETE' });
    load();
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  if (editing) {
    return (
      <PageEditor
        page={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard/admin/settings" className="text-sm text-muted hover:text-brand">← Settings</Link>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Page builder</h1>
          <p className="mt-1 text-muted">Custom static pages — About, Terms, Privacy, or anything else. Rendered at /page/&lt;slug&gt;.</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary">+ New page</button>
      </div>

      <div className="card mt-6 divide-y divide-line">
        {pages.length === 0 ? (
          <div className="p-10 text-center text-muted">No custom pages yet.</div>
        ) : (
          pages.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  {p.title}
                  {!p.status && <span className="badge bg-line text-muted">Draft</span>}
                </div>
                <div className="text-xs text-muted">/page/{p.slug}</div>
              </div>
              <a href={`/page/${p.slug}`} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">View</a>
              <button onClick={() => setEditing(p)} className="text-sm text-brand hover:underline">Edit</button>
              <button onClick={() => remove(p.id)} className="text-sm text-red-500 hover:underline">Delete</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PageEditor({ page, onDone }: { page: CustomPage | null; onDone: () => void }) {
  const [title, setTitle] = useState(page?.title ?? '');
  const [content, setContent] = useState(page?.content ?? '');
  const [status, setStatus] = useState(page?.status ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) { setErr('Title is required'); return; }
    setBusy(true); setErr(null);
    try {
      if (page) {
        await api(`/admin/pages/${page.id}`, { method: 'PUT', body: JSON.stringify({ title, content, status }) });
      } else {
        await api('/admin/pages', { method: 'POST', body: JSON.stringify({ title, content, status }) });
      }
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
      setBusy(false);
    }
  };

  return (
    <div className="container-page max-w-3xl py-10">
      <button onClick={onDone} className="text-sm text-muted hover:text-brand">← Page builder</button>
      <h1 className="mt-3 text-3xl font-extrabold">{page ? 'Edit page' : 'New page'}</h1>

      <div className="card mt-6 space-y-5 p-6">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="About" />
          {page && <p className="mt-1 text-xs text-muted">URL: /page/{page.slug}</p>}
        </div>
        <div>
          <label className="label">Content (HTML)</label>
          <textarea
            className="input min-h-[280px] font-mono text-sm"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="<p>Write your page content here…</p>"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={status} onChange={(e) => setStatus(e.target.checked)} />
          Published (visible to the public)
        </label>

        {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

        <div className="flex gap-3">
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          <button onClick={onDone} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}
