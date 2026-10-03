'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { tokenStore } from '@/lib/api';
import { useAuth } from '@/lib/providers';

/**
 * Landing page for social sign-in. The API redirects here with fresh JWTs:
 *   /auth/callback?accessToken=…&refreshToken=…&principal=…
 * We persist them, hydrate the session, and route to the right dashboard.
 */
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const principal = params.get('principal');
    const next = params.get('next');
    if (!accessToken || !refreshToken) {
      setError('Sign-in failed — missing credentials. Please try again.');
      return;
    }
    tokenStore.set(accessToken, refreshToken);
    refresh()
      .then(() => {
        router.replace(
          next ??
            (principal === 'admin'
              ? '/dashboard/admin'
              : principal === 'instructor'
                ? '/dashboard/instructor'
                : '/dashboard'),
        );
      })
      .catch(() => setError('Could not start your session — please log in with email.'));
  }, [params, refresh, router]);

  if (error) {
    return (
      <div className="container-page max-w-md py-20 text-center">
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>
        <a href="/login" className="btn-primary mt-6 inline-block">Back to login</a>
      </div>
    );
  }
  return <div className="container-page py-20 text-center text-muted">Signing you in…</div>;
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center">Loading…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
