'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { AuthShell, SecureBadges } from '@/components/auth-panel';

function ForgotInner() {
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, role: isAdmin ? 'admin' : 'user' }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the reset email');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Forgot password?</h1>
      <p className="mt-2 text-[15px] text-muted">
        Enter the email address on your account and we&apos;ll send you a link to choose a new password.
      </p>

      {sent ? (
        <div className="mt-7 space-y-5">
          <p className="rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-600">
            If an account exists for <span className="font-semibold">{email}</span>, a reset link is on its way.
            It expires in 1 hour.
          </p>
          <Link href="/login" className="btn-primary w-full rounded-xl py-3.5 text-[15px]">
            Back to sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label">Email address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-11"
                style={{ paddingLeft: '2.75rem' }}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-brand"
            />
            This is an administrator account
          </label>
          {error && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{error}</p>}
          <button disabled={busy} className="btn-primary w-full rounded-xl py-3.5 text-[15px]">
            {busy ? 'Sending…' : (<>Send reset link <ArrowRight className="h-4 w-4" /></>)}
          </button>
          <p className="text-center text-sm text-muted">
            Remembered it?{' '}
            <Link href="/login" className="font-bold text-brand hover:underline">Sign in</Link>
          </p>
        </form>
      )}
      <SecureBadges />
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-muted">Loading…</div>}>
      <ForgotInner />
    </Suspense>
  );
}
