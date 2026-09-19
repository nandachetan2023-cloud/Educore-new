'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/settings'); return; }
    if (user.adminRole !== 'super_admin') { router.push('/dashboard/admin'); return; }
  }, [user, authLoading]);

  if (authLoading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Settings</h1>
      <p className="mt-1 text-muted">Site-wide configuration and maintenance tools.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Link href="/dashboard/admin/settings/mail" className="card p-5 transition hover:border-brand/40">
          <div className="font-semibold">Mail configuration</div>
          <div className="mt-1 text-sm text-muted">Configure SMTP without redeploying.</div>
        </Link>
        <Link href="/dashboard/admin/settings/files" className="card p-5 transition hover:border-brand/40">
          <div className="font-semibold">File manager</div>
          <div className="mt-1 text-sm text-muted">Browse and remove uploaded files.</div>
        </Link>
        <Link href="/dashboard/admin/settings/pages" className="card p-5 transition hover:border-brand/40">
          <div className="font-semibold">Page builder</div>
          <div className="mt-1 text-sm text-muted">Edit custom static pages (About, Terms…).</div>
        </Link>
        <Link href="/dashboard/admin/settings/certificate" className="card p-5 transition hover:border-brand/40">
          <div className="font-semibold">Certificate builder</div>
          <div className="mt-1 text-sm text-muted">Design the certificate PDF layout.</div>
        </Link>
        <Link href="/dashboard/admin/settings/contact" className="card p-5 transition hover:border-brand/40">
          <div className="font-semibold">Contact page</div>
          <div className="mt-1 text-sm text-muted">Edit title, details, and design of the contact page.</div>
        </Link>
      </div>

      <DangerZone />
    </div>
  );
}

function DangerZone() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const clear = async () => {
    if (!confirm(
      'This permanently deletes all orders, cart items, enrollments, reviews, watch history, and withdrawal requests.\n\n' +
      'Courses, categories, and user accounts are NOT affected.\n\nThis cannot be undone. Continue?',
    )) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const res = await api<{ cleared: Record<string, number> }>('/admin/data/clear', { method: 'POST' });
      setResult(res.cleared);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to clear data');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mt-10 border-red-500/30 p-6">
      <h2 className="text-lg font-bold text-red-500">Danger zone</h2>
      <p className="mt-1 text-sm text-muted">
        Wipe transactional/demo data — orders, cart, enrollments, reviews, watch history, and withdrawals —
        so this install can go live cleanly. Accounts, courses, and catalog structure are kept.
      </p>

      {result && (
        <div className="mt-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-600">
          Cleared: {Object.entries(result).map(([k, v]) => `${k} (${v})`).join(', ')}
        </div>
      )}
      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <button
        onClick={clear}
        disabled={busy}
        className="btn mt-5 border border-red-500 px-5 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10"
      >
        {busy ? 'Clearing…' : 'Clear transactional data'}
      </button>
    </div>
  );
}
