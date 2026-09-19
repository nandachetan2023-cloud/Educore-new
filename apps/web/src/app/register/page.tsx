'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, tokenStore, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';

export default function RegisterPage() {
  const router = useRouter();
  const branding = useBranding();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' as 'student' | 'instructor' });
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

  return (
    <div className="container-page flex min-h-[75vh] items-center justify-center py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-extrabold">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Start learning on {branding?.name} today</p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
          {(['student', 'instructor'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, role: r }))}
              className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                form.role === r ? 'bg-brand text-white shadow' : 'text-muted hover:text-ink'
              }`}
            >
              {r === 'student' ? 'Learn' : 'Teach'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Full name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" required className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required minLength={8} className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            <p className="mt-1 text-xs text-muted">At least 8 characters</p>
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
          <button disabled={busy} className="btn-primary w-full py-3">{busy ? 'Creating…' : 'Create account'}</button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
