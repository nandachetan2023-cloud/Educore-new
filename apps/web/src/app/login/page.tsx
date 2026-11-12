'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';

import { api, tokenStore, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { AuthShell, SecureBadges, SocialButtons } from '@/components/auth-panel';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const oauthError = params.get('error');
  const oauthErrorMessage =
    oauthError === 'oauth_denied'
      ? 'Social sign-in was cancelled — please try again or use email.'
      : oauthError === 'saml_unavailable'
        ? 'Single sign-on is not configured for this workspace.'
        : oauthError === 'saml_failed'
          ? 'Single sign-on failed — please try again or use email.'
          : oauthError
            ? 'Social sign-in failed — please try again or use email.'
            : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (challengeToken) {
        const res = await api<{ accessToken: string; refreshToken: string; principal: string }>('/auth/2fa/verify', {
          method: 'POST',
          auth: false,
          body: JSON.stringify({ challengeToken, code: twoFactorCode }),
        });
        tokenStore.set(res.accessToken, res.refreshToken, remember);
        await refresh();
        const next = params.get('next');
        router.push(next ?? (res.principal === 'admin' ? '/dashboard/admin' : res.principal === 'instructor' ? '/dashboard/instructor' : '/dashboard'));
        return;
      }
      const path = isAdmin ? '/auth/admin/login' : '/auth/login';
      const res = await api<{ accessToken?: string; refreshToken?: string; principal?: string; requiresTwoFactor?: boolean; challengeToken?: string }>(path, {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password, rememberMe: remember }),
      });
      if (res.requiresTwoFactor && res.challengeToken) {
        setChallengeToken(res.challengeToken);
        setTwoFactorCode('');
        setError(null);
        return;
      }
      if (!res.accessToken || !res.refreshToken) throw new Error('Login failed');
      tokenStore.set(res.accessToken, res.refreshToken, remember);
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
    <AuthShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-[15px] text-muted">Enter your credentials to access your courses.</p>

      <div className="mt-7">
        <SocialButtons />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="email" required placeholder="name@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-11" style={{ paddingLeft: '2.75rem' }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-0">Password</label>
            <Link href="/forgot-password" className="text-[13px] font-semibold text-brand hover:underline">Forgot password?</Link>
          </div>
          <div className="relative mt-1.5">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type={showPw ? 'text' : 'password'} required placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-11" style={{ paddingLeft: '2.75rem' }}
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} aria-label="Toggle password visibility" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-muted">
            <input type="checkbox" checked={remember} disabled={Boolean(challengeToken)} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-line accent-brand" />
            Remember me
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm text-muted">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="h-4 w-4 rounded border-line accent-brand" />
          Log in as administrator
        </label>
        {challengeToken && (
          <div>
            <label className="label">Authenticator code</label>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" required placeholder="123456" value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              className="input" autoComplete="one-time-code"
            />
            <button type="button" onClick={() => { setChallengeToken(null); setTwoFactorCode(''); }} className="mt-2 text-xs text-muted underline">
              Use a different account
            </button>
          </div>
        )}
        {oauthErrorMessage && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{oauthErrorMessage}</p>}
        {error && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{error}</p>}
        <button disabled={busy} className="btn-primary w-full rounded-xl py-3.5 text-[15px]">
          {busy ? 'Signing in…' : (<>Sign In <ArrowRight className="h-4 w-4" /></>)}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-bold text-brand hover:underline">Sign up</Link>
      </p>

      <SecureBadges />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
