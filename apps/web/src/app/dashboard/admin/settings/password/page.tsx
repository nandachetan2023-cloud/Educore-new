'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';

export default function AdminPasswordPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (next !== confirm) { setErr('The new passwords do not match'); return; }
    if (next.length < 8) { setErr('Use at least 8 characters'); return; }
    setBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setMsg('Password updated. Use the new one the next time you sign in.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? `${e2.message} (HTTP ${e2.status})` : 'Could not change the password');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <DirectoryShell
      eyebrow="Admin Console"
      sections={[
        {
          heading: 'Account',
          links: [
            { href: '/dashboard/admin/settings/password', label: 'Change password', icon: KeyRound },
            { href: '/dashboard/admin/users', label: 'Users & Directory', icon: ShieldCheck },
            { href: '/dashboard/admin', label: 'Back to Console', icon: LayoutDashboard, match: '' },
          ],
        },
      ]}
      userName={user?.name ?? 'Admin'}
      userCaption="Tenant admin"
      userImage={user?.image}
      onLogout={logout}
    >
      <div style={{ fontFamily: 'var(--font-admin-body)' }}>
        <div className="mx-auto max-w-[640px]">
          <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
          <h1 className="mb-1 mt-2 text-[27px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-admin-display)' }}>Change password</h1>
          <p className="mb-6 text-sm text-muted">
            You are signed in as {user?.email}. Set a new password — your current one is required to confirm it is you.
          </p>

          <form onSubmit={submit} className="rounded-2xl border border-[#EAE6DB] bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Current password</label>
                <input type="password" required autoComplete="current-password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">New password</label>
                <input type="password" required minLength={8} autoComplete="new-password" className="input" value={next} onChange={(e) => setNext(e.target.value)} />
                <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Confirm new password</label>
                <input type="password" required minLength={8} autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>

            {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{err}</p>}
            {msg && <p className="mt-4 rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-700">{msg}</p>}

            <div className="mt-6 flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Update password'}</button>
              <button type="button" onClick={() => router.push('/dashboard/admin')} className="btn-ghost">Cancel</button>
            </div>
          </form>

          <p className="mt-6 rounded-2xl border border-[#EAE6DB] bg-[#FAF8F2] p-5 text-sm text-muted">
            <strong className="text-ink">Locked out?</strong> Admins and learners can both use “Forgot password” on the sign-in screen — the reset link works for both account types. A tenant admin can also reset a learner's password from
            {' '}<Link href="/dashboard/admin/users" className="text-brand hover:underline">Users &amp; Directory</Link>.
          </p>
        </div>
      </div>
    </DirectoryShell>
  );
}
