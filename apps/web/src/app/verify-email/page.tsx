'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { AuthShell, SecureBadges } from '@/components/auth-panel';

type State = 'verifying' | 'success' | 'error';

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>(token ? 'verifying' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing its token.');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api('/auth/verify-email', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ token }),
    })
      .then(() => {
        if (!cancelled) setState('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setState('error');
        setMessage(
          err instanceof ApiError ? err.message : 'We could not verify this address. Try requesting a new link.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Email verification</h1>

      <div className="mt-7 space-y-5">
        {state === 'verifying' && (
          <p className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Confirming your email address…
          </p>
        )}
        {state === 'success' && (
          <p className="flex items-start gap-3 rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Your email address is verified. You can close this tab or continue to your dashboard.
          </p>
        )}
        {state === 'error' && (
          <p className="flex items-start gap-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {message}
          </p>
        )}

        <Link href={state === 'success' ? '/dashboard' : '/login'} className="btn-primary w-full rounded-xl py-3.5 text-[15px]">
          {state === 'success' ? 'Go to dashboard' : 'Back to sign in'} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <SecureBadges />
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-muted">Loading…</div>}>
      <VerifyInner />
    </Suspense>
  );
}
