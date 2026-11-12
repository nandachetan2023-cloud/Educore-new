'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { AuthShell, SecureBadges } from '@/components/auth-panel';

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('The passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Choose a new password</h1>
      <p className="mt-2 text-[15px] text-muted">Pick a strong password you haven&apos;t used before.</p>

      {!token ? (
        <div className="mt-7 space-y-5">
          <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">
            This reset link is missing its token. Request a new one.
          </p>
          <Link href="/forgot-password" className="btn-primary w-full rounded-xl py-3.5 text-[15px]">
            Request a new link <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : done ? (
        <div className="mt-7 space-y-5">
          <p className="rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-600">
            Password saved. Taking you to sign in…
          </p>
          <Link href="/login" className="btn-primary w-full rounded-xl py-3.5 text-[15px]">
            Sign in now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label">New password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type={showPw ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-11 pr-11"
                style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label="Toggle password visibility"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Repeat the password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
            />
          </div>
          {error && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{error}</p>}
          <button disabled={busy} className="btn-primary w-full rounded-xl py-3.5 text-[15px]">
            {busy ? 'Saving…' : (<>Save new password <ArrowRight className="h-4 w-4" /></>)}
          </button>
          <p className="text-center text-sm text-muted">
            <Link href="/login" className="font-bold text-brand hover:underline">Back to sign in</Link>
          </p>
        </form>
      )}
      <SecureBadges />
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-muted">Loading…</div>}>
      <ResetInner />
    </Suspense>
  );
}
