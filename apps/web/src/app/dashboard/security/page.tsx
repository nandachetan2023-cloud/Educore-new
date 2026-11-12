'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen, GraduationCap, KeyRound, LayoutDashboard, LogOut, Mail, ShieldCheck, User,
} from 'lucide-react';
import { api, ApiError, tokenStore } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';

export default function SecurityPage() {
  const { user, loading: authLoading, logout, refresh } = useAuth();
  const branding = useBranding();
  const router = useRouter();

  const [emailForm, setEmailForm] = useState({ currentPassword: '', newEmail: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null);
  const [twoFaUrl, setTwoFaUrl] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaMsg, setTwoFaMsg] = useState<string | null>(null);
  const [twoFaErr, setTwoFaErr] = useState<string | null>(null);
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  if (authLoading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const roleLabel =
    user?.principal === 'admin'
      ? user.adminRole === 'super_admin' ? 'Platform Super Admin' : 'Workspace Admin'
      : user?.principal === 'instructor' ? 'Instructor' : 'Student';

  const updateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailErr(null); setEmailMsg(null);
    setBusy(true);
    try {
      const res = await api<{ email: string; accessToken?: string; refreshToken?: string }>('/auth/change-email', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: emailForm.currentPassword, newEmail: emailForm.newEmail }),
      });
      if (res.accessToken && res.refreshToken) tokenStore.set(res.accessToken, res.refreshToken);
      setEmailMsg(`Email updated to ${res.email}. We sent a confirmation to the new address.`);
      setEmailForm({ currentPassword: '', newEmail: '' });
      router.refresh();
    } catch (e2) {
      setEmailErr(e2 instanceof ApiError ? `${e2.message} (HTTP ${e2.status})` : 'Could not update your email');
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassErr(null); setPassMsg(null);
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassErr('The new passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword }),
      });
      setPassMsg('Password saved. Use the new one the next time you sign in.');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e2) {
      setPassErr(e2 instanceof ApiError ? `${e2.message} (HTTP ${e2.status})` : 'Could not change your password');
    } finally {
      setBusy(false);
    }
  };

  const setupTwoFactor = async () => {
    setTwoFaErr(null); setTwoFaMsg(null);
    setTwoFaBusy(true);
    try {
      const res = await api<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST' });
      setTwoFaSecret(res.secret);
      setTwoFaUrl(res.otpauthUrl);
    } catch (e2) {
      setTwoFaErr(e2 instanceof ApiError ? e2.message : 'Could not start 2FA setup');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const enableTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaErr(null); setTwoFaMsg(null);
    setTwoFaBusy(true);
    try {
      await api('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code: twoFaCode }) });
      setTwoFaMsg('Two-factor authentication enabled.');
      setTwoFaSecret(null); setTwoFaUrl(null); setTwoFaCode('');
      await refresh();
    } catch (e2) {
      setTwoFaErr(e2 instanceof ApiError ? e2.message : 'Could not enable 2FA');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const disableTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaErr(null); setTwoFaMsg(null);
    setTwoFaBusy(true);
    try {
      await api('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code: twoFaCode }) });
      setTwoFaMsg('Two-factor authentication disabled.');
      setTwoFaCode('');
      await refresh();
    } catch (e2) {
      setTwoFaErr(e2 instanceof ApiError ? e2.message : 'Could not disable 2FA');
    } finally {
      setTwoFaBusy(false);
    }
  };

  return (
    <DirectoryShell
      eyebrow="Student Workspace"
      sections={[
        {
          heading: 'Learn',
          links: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/courses', label: 'Browse Courses', icon: BookOpen },
            { href: '/become-instructor', label: 'Become an Instructor', icon: GraduationCap },
          ],
        },
        {
          heading: 'Account',
          links: [
            { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
            { href: '/dashboard/profile', label: 'Profile', icon: User },
          ],
        },
      ]}
      userName={user?.name ?? 'Student'}
      userCaption={roleLabel}
      userImage={user?.image}
      onLogout={logout}
    >
      <div className="mx-auto max-w-[1100px]">
        {/* Breadcrumb-style header, matching the template's dashboard pages */}
        <div
          className="relative overflow-hidden rounded-2xl bg-[#101418] px-6 py-8 sm:px-10"
          style={{ backgroundImage: 'url(/images/breadcrumb_bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#101418] via-[#101418]/85 to-transparent" />
          <div className="relative">
            <nav className="flex items-center gap-2 text-xs text-white/60">
              <Link href="/dashboard" className="hover:text-white">Home</Link>
              <span aria-hidden>/</span>
              <span className="text-white/90">Security</span>
            </nav>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">Security</h1>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Profile card (template sidebar) */}
          <aside className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
            <div className="h-24 w-full bg-[#101418] bg-cover bg-center" style={{ backgroundImage: 'url(/images/single_topic_sidebar_banner.jpg)' }} />
            <div className="-mt-10 px-5 pb-5 text-center">
              <span className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full border-4 border-card bg-brand text-2xl font-extrabold text-white">
                {user?.image ? <img src={user.image} alt="" className="h-full w-full object-cover" /> : (user?.name?.[0] ?? 'U').toUpperCase()}
              </span>
              <h2 className="mt-3 font-bold text-ink">{user?.name ?? 'Account'}</h2>
              <p className="text-[13px] text-muted">{roleLabel}</p>
            </div>
            <div className="border-t border-line">
              {[
                { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/courses', label: 'Courses', icon: BookOpen },
                { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-3 border-b border-line px-5 py-3 text-sm font-semibold transition last:border-0 hover:bg-surface ${
                    l.href === '/dashboard/security' ? 'text-brand' : 'text-ink'
                  }`}
                >
                  <l.icon className="h-4 w-4" /> {l.label}
                </Link>
              ))}
              <button onClick={logout} className="flex w-full items-center gap-3 border-t border-line px-5 py-3 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50">
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-ink">Security update</h2>
              <p className="text-[13px] text-muted">Manage the email address and password on your account.</p>
            </div>

            {/* Email address */}
            <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-ink">Email Address</h3>
                  <p className="text-[13px] text-muted">
                    Your current email address is <span className="font-semibold text-ink">{user?.email}</span>
                  </p>
                </div>
              </div>

              <form onSubmit={updateEmail} className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Current password</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    className="input"
                    value={emailForm.currentPassword}
                    onChange={(e) => setEmailForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    placeholder="Confirm it is you"
                  />
                </div>
                <div>
                  <label className="label">New email address</label>
                  <input
                    type="email"
                    required
                    className="input"
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm((f) => ({ ...f, newEmail: e.target.value }))}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button disabled={busy} className="btn-primary">
                    {busy ? 'Updating…' : 'Update email'}
                  </button>
                </div>
                {emailErr && <p className="sm:col-span-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{emailErr}</p>}
                {emailMsg && !emailErr && <p className="sm:col-span-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{emailMsg}</p>}
              </form>
            </section>

            {/* Password */}
            <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-green-500/10 text-green-600">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-ink">Change Password</h3>
                  <p className="text-[13px] text-muted">
                    We will email you a confirmation when changing your password, so please expect that email after
                    submitting.
                  </p>
                </div>
              </div>

              <form onSubmit={updatePassword} className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Current Password</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    className="input"
                    value={passForm.currentPassword}
                    onChange={(e) => setPassForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    placeholder="Enter Current Password"
                  />
                </div>
                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input"
                    value={passForm.newPassword}
                    onChange={(e) => setPassForm((f) => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Enter New Password"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Confirm Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input"
                    value={passForm.confirmPassword}
                    onChange={(e) => setPassForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Confirm New Password"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button disabled={busy} className="btn-primary">
                    {busy ? 'Saving…' : 'Save Password'}
                  </button>
                </div>
                {passErr && <p className="sm:col-span-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{passErr}</p>}
                {passMsg && !passErr && <p className="sm:col-span-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{passMsg}</p>}
              </form>
            </section>

            {/* Two-factor authentication */}
            <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-ink">Two-Factor Authentication</h3>
                  <p className="text-[13px] text-muted">
                    Add a second step to sign-in using an authenticator app (Google Authenticator, Authy, 1Password).
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    user?.twoFactorEnabled ? 'bg-green-500/10 text-green-600' : 'bg-surface text-muted'
                  }`}
                >
                  {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {twoFaErr && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{twoFaErr}</p>}
              {twoFaMsg && !twoFaErr && <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{twoFaMsg}</p>}

              {!user?.twoFactorEnabled && !twoFaSecret && (
                <div className="mt-5">
                  <button onClick={setupTwoFactor} disabled={twoFaBusy} className="btn-primary">
                    {twoFaBusy ? 'Starting…' : 'Set up 2FA'}
                  </button>
                </div>
              )}

              {!user?.twoFactorEnabled && twoFaSecret && (
                <form onSubmit={enableTwoFactor} className="mt-5 space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    {twoFaUrl && (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(twoFaUrl)}`}
                        alt="Scan this QR code with your authenticator app"
                        width={180}
                        height={180}
                        className="rounded-xl border border-line bg-white p-2"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-muted">
                        Scan the QR code, or add this secret manually to your authenticator app:
                      </p>
                      <code className="mt-2 block break-all rounded-lg bg-surface px-3 py-2 text-[12px] font-semibold text-ink">
                        {twoFaSecret}
                      </code>
                      {twoFaUrl && (
                        <a href={twoFaUrl} className="mt-2 inline-block text-[13px] font-semibold text-brand hover:underline">
                          Open in authenticator app
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="label">Enter the 6-digit code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      placeholder="123456"
                      className="input"
                      value={twoFaCode}
                      onChange={(e) => setTwoFaCode(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={twoFaBusy} className="btn-primary">
                      {twoFaBusy ? 'Verifying…' : 'Enable 2FA'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTwoFaSecret(null); setTwoFaUrl(null); setTwoFaCode(''); }}
                      className="btn-ghost"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {user?.twoFactorEnabled && (
                <form onSubmit={disableTwoFactor} className="mt-5 space-y-4">
                  <div className="max-w-xs">
                    <label className="label">Authenticator code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      placeholder="123456"
                      className="input"
                      value={twoFaCode}
                      onChange={(e) => setTwoFaCode(e.target.value)}
                    />
                  </div>
                  <button disabled={twoFaBusy} className="rounded-full border border-red-500/40 px-5 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-500/10">
                    {twoFaBusy ? 'Disabling…' : 'Disable 2FA'}
                  </button>
                </form>
              )}
            </section>

            <p className="text-xs text-muted">
              Account type: <span className="font-semibold text-ink">{roleLabel}</span> · Platform currency{' '}
              <span className="font-semibold text-ink">{branding?.currency ?? 'INR'}</span>
            </p>
          </div>
        </div>
      </div>
    </DirectoryShell>
  );
}
