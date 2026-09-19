'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, tokenStore, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const branding = useBranding();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = isAdmin ? '/auth/admin/login' : '/auth/login';
      const res = await api<{ accessToken: string; refreshToken: string; principal: string }>(path, {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      tokenStore.set(res.accessToken, res.refreshToken);
      await refresh();
      const next = params.get('next');
      router.push(next ?? (res.principal === 'admin' ? '/dashboard/admin' : res.principal === 'instructor' ? '/dashboard/instructor' : '/dashboard'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page flex min-h-[75vh] items-center justify-center py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Log in to your {branding?.name} account</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
            Log in as administrator
          </label>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
          <button disabled={busy} className="btn-primary w-full py-3">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          New here?{' '}
          <Link href="/register" className="font-semibold text-brand hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
