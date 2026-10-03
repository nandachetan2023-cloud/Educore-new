'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, FlaskConical, Lock, Mail } from 'lucide-react';
import { api, tokenStore, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { AuthShell, SecureBadges, SocialButtons } from '@/components/auth-panel';

/** Seeded demo accounts (see README + prisma/seed.ts) — click to fill. */
const DEMO_ACCOUNTS = [
  { role: 'Super-admin', email: 'superadmin@gmail.com', password: 'password', admin: true, can: 'Everything + rebranding + staff' },
  { role: 'Admin', email: 'admin@gmail.com', password: 'password', admin: true, can: 'Moderation, approvals' },
  { role: 'Instructor', email: 'instructor@gmail.com', password: '12345678', admin: false, can: 'Create/sell courses, payouts' },
  { role: 'Student', email: 'user@gmail.com', password: '12345678', admin: false, can: 'Buy, learn, review' },
];

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

  const oauthError = params.get('error');
  const oauthErrorMessage =
    oauthError === 'oauth_denied'
      ? 'Social sign-in was cancelled — please try again or use email.'
      : oauthError
        ? 'Social sign-in failed — please try again or use email.'
        : null;

  const fillDemo = (d: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(d.email);
    setPassword(d.password);
    setIsAdmin(d.admin);
    setError(null);
  };

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
            <span className="text-[13px] font-semibold text-brand">Forgot password?</span>
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
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-line accent-brand" />
            Remember me for 30 days
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm text-muted">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="h-4 w-4 rounded border-line accent-brand" />
          Log in as administrator
        </label>
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

      {/* Demo accounts for all roles — click a row to fill the form. */}
      <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted">
          <FlaskConical className="h-3.5 w-3.5" /> Demo accounts — click to fill
        </p>
        <div className="mt-3 space-y-1.5">
          {DEMO_ACCOUNTS.map((d) => (
            <button
              key={d.role}
              type="button"
              onClick={() => fillDemo(d)}
              title={`${d.email} / ${d.password} — ${d.can}`}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13px] transition hover:border-brand/50 hover:bg-card ${
                email === d.email ? 'border-brand/60 bg-card' : 'border-line bg-card/50'
              }`}
            >
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  d.role === 'Super-admin'
                    ? 'bg-brand text-white'
                    : d.role === 'Admin'
                      ? 'bg-violet-500/15 text-violet-600'
                      : d.role === 'Instructor'
                        ? 'bg-amber-500/15 text-amber-600'
                        : 'bg-green-500/15 text-green-600'
                }`}
              >
                {d.role}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{d.email}</span>
              <span className="hidden shrink-0 text-[11px] text-muted sm:block">{d.can}</span>
            </button>
          ))}
        </div>
      </div>
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
