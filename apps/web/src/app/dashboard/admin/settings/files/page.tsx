'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

interface UploadedFile {
  path: string;
  url: string;
  size: number;
  modifiedAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_ICON: Record<string, string> = {
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
  mp4: '🎬', webm: '🎬', mp3: '🎵', pdf: '📕', doc: '📄', docx: '📄', zip: '🗜️',
};

export default function FileManagerPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busyPath, setBusyPath] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<UploadedFile[]>('/uploads')
      .then(setFiles)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load files'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/settings/files'); return; }
    if (user.adminRole !== 'super_admin') { router.push('/dashboard/admin'); return; }
    load();
  }, [user, authLoading]);

  const remove = async (path: string) => {
    if (!confirm(`Delete "${path}"? This cannot be undone.`)) return;
    setBusyPath(path);
    try {
      await api(`/uploads?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
      setFiles((f) => f.filter((x) => x.path !== path));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to delete');
    } finally {
      setBusyPath(null);
    }
  };

  const filtered = files.filter((f) => f.path.toLowerCase().includes(query.toLowerCase()));
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  if (authLoading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/dashboard/admin/settings" className="text-sm text-muted hover:text-brand">← Settings</Link>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">File manager</h1>
          <p className="mt-1 text-muted">
            {files.length} file{files.length === 1 ? '' : 's'} · {formatSize(totalSize)} total
          </p>
        </div>
        <input
          className="input w-56"
          placeholder="Search files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="card mt-6 divide-y divide-line">
        {loading ? (
          <div className="p-10 text-center text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted">
            {files.length === 0 ? 'No uploaded files yet.' : 'No files match your search.'}
          </div>
        ) : (
          filtered.map((f) => {
            const ext = f.path.split('.').pop()?.toLowerCase() ?? '';
            return (
              <div key={f.path} className="flex items-center gap-4 p-4">
                <span className="text-2xl">{KIND_ICON[ext] ?? '📁'}</span>
                <div className="min-w-0 flex-1">
                  <a href={f.url} target="_blank" rel="noreferrer" className="block truncate font-medium hover:text-brand">
                    {f.path}
                  </a>
                  <div className="text-xs text-muted">
                    {formatSize(f.size)} · {new Date(f.modifiedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => remove(f.path)}
                  disabled={busyPath === f.path}
                  className="text-sm text-red-500 hover:underline disabled:opacity-50"
                >
                  {busyPath === f.path ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
