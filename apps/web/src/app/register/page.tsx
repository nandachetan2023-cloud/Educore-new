'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { api, tokenStore, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { AuthShell, SecureBadges, SocialButtons } from '@/components/auth-panel';

export default function RegisterPage() {
  const router = useRouter();
  const branding = useBranding();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' as 'student' | 'instructor' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ accessToken: string; refreshToken: string; principal: string }>('/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(form),
      });
      tokenStore.set(res.accessToken, res.refreshToken);
      await refresh();
      router.push(res.principal === 'instructor' ? '/dashboard/instructor' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <AuthShell>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Create your account</h1>
      <p className="mt-2 text-[15px] text-muted">Start learning on {branding?.name ?? 'EduCore'} today.</p>

      <div className="mt-7">
        <SocialButtons role={form.role} />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
        {(['student', 'instructor'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => set('role', r)}
            className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
              form.role === r ? 'bg-card text-ink shadow' : 'text-muted hover:text-ink'
            }`}
          >
            {r === 'student' ? 'Learn' : 'Teach'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="label">Full name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input required placeholder="John Doe" value={form.name} onChange={(e) => set('name', e.target.value)} className="input" style={{ paddingLeft: '2.75rem' }} />
          </div>
        </div>
        <div>
          <label className="label">Email address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input type="email" required placeholder="name@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" style={{ paddingLeft: '2.75rem' }} />
          </div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input type={showPw ? 'text' : 'password'} required minLength={8} placeholder="At least 8 characters" value={form.password} onChange={(e) => set('password', e.target.value)} className="input" style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }} />
            <button type="button" onClick={() => setShowPw((s) => !s)} aria-label="Toggle password visibility" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {error && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{error}</p>}
        <button disabled={busy} className="btn-primary w-full rounded-xl py-3.5 text-[15px]">
          {busy ? 'Creating…' : (<>Create account <ArrowRight className="h-4 w-4" /></>)}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-brand hover:underline">Log in</Link>
      </p>
      <SecureBadges />
    </AuthShell>
  );
}
