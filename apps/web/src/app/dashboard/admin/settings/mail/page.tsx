'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

interface MailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

interface QueueJob {
  id: number;
  to: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  lastError?: string | null;
  createdAt: string;
}
interface QueueStats { pending: number; sent: number; failed: number; recent: QueueJob[] }

const STATUS_STYLE: Record<QueueJob['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-600',
  sent: 'bg-green-500/15 text-green-600',
  failed: 'bg-red-500/15 text-red-600',
};

export default function MailSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<MailConfig>({ host: '', port: 587, user: '', password: '', from: '' });
  const [queue, setQueue] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadQueue = () => api<QueueStats>('/admin/mail-settings/queue').then(setQueue).catch(() => {});

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/settings/mail'); return; }
    if (user.adminRole !== 'super_admin') { router.push('/dashboard/admin'); return; }
    api<MailConfig>('/admin/mail-settings').then(setForm).catch(() => {}).finally(() => setLoading(false));
    loadQueue();
    const interval = setInterval(loadQueue, 15000);
    return () => clearInterval(interval);
  }, [user, authLoading]);

  const set = (k: keyof MailConfig) => (v: string) => setForm((f) => ({ ...f, [k]: k === 'port' ? Number(v) : v }));

  const save = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      // Don't overwrite a real stored password with the masked placeholder.
      const payload = { ...form, password: form.password === '••••••••' ? undefined : form.password };
      await api('/admin/mail-settings', { method: 'PUT', body: JSON.stringify(payload) });
      setMsg('Mail settings saved.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setTesting(true); setMsg(null); setErr(null);
    try {
      const res = await api<{ sent: boolean; to: string }>('/admin/mail-settings/test', { method: 'POST' });
      setMsg(`Test email sent to ${res.to}.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="container-page max-w-2xl py-10">
      <Link href="/dashboard/admin/settings" className="text-sm text-muted hover:text-brand">← Settings</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Mail configuration</h1>
      <p className="mt-1 text-muted">
        Configure the SMTP server used for instructor approval emails and other notifications.
        Leaving the host blank suppresses emails (they're logged instead) — useful for local development.
      </p>

      <div className="card mt-6 space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label">SMTP host</label>
            <input className="input" placeholder="smtp.mailgun.org" value={form.host} onChange={(e) => set('host')(e.target.value)} />
          </div>
          <div>
            <label className="label">Port</label>
            <input type="number" className="input" value={form.port} onChange={(e) => set('port')(e.target.value)} />
          </div>
          <div>
            <label className="label">Username</label>
            <input className="input" value={form.user} onChange={(e) => set('user')(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={form.password} onChange={(e) => set('password')(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">From address</label>
          <input className="input" placeholder="EduCore <no-reply@example.com>" value={form.from} onChange={(e) => set('from')(e.target.value)} />
        </div>

        {msg && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{msg}</p>}
        {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

        <div className="flex gap-3">
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          <button onClick={sendTest} disabled={testing || !form.host} className="btn-ghost">
            {testing ? 'Sending…' : 'Send test email'}
          </button>
        </div>
      </div>

      <h2 className="mt-10 text-xl font-bold">Send queue</h2>
      <p className="mt-1 text-sm text-muted">
        Notification emails (instructor approvals, etc.) go through a background queue with automatic retry
        instead of sending synchronously — a slow or down mail server won't block the request that triggered it.
      </p>

      {queue && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <div className="text-2xl font-black text-amber-500">{queue.pending}</div>
            <div className="text-xs text-muted">Pending</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-black text-green-600">{queue.sent}</div>
            <div className="text-xs text-muted">Sent</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-black text-red-500">{queue.failed}</div>
            <div className="text-xs text-muted">Failed</div>
          </div>
        </div>
      )}

      <div className="card mt-4 divide-y divide-line">
        {!queue || queue.recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">No emails queued yet.</div>
        ) : (
          queue.recent.map((j) => (
            <div key={j.id} className="flex items-center gap-4 p-4 text-sm">
              <span className={`badge shrink-0 ${STATUS_STYLE[j.status]}`}>{j.status}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{j.subject}</div>
                <div className="truncate text-xs text-muted">
                  to {j.to} · {new Date(j.createdAt).toLocaleString()}
                  {j.attempts > 0 && ` · ${j.attempts} attempt${j.attempts === 1 ? '' : 's'}`}
                </div>
                {j.lastError && <div className="mt-0.5 truncate text-xs text-red-500">{j.lastError}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
