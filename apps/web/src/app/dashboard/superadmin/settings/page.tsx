'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  CreditCard,
  Database,
  Globe,
  HardDrive,
  Mail,
  Server,
  ShieldCheck,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';
import type { PlatformEnv, PlatformSettingsValues } from '@/lib/types';
import { BackLink } from '@/components/back-link';

const ENV_TINT: Record<string, string> = {
  production: 'bg-green-500/15 text-green-600',
  development: 'bg-amber-500/15 text-amber-600',
};

function StatusBadge({ ok, okLabel = 'Configured' }: { ok: boolean; okLabel?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        ok ? 'bg-green-500/15 text-green-600' : 'bg-amber-500/15 text-amber-600'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {ok ? okLabel : 'Not configured'}
    </span>
  );
}

function InfoTile({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-card p-4">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-ink">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export default function PlatformSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [env, setEnv] = useState<PlatformEnv | null>(null);
  const [settings, setSettings] = useState<PlatformSettingsValues | null>(null);
  const [form, setForm] = useState({ supportEmail: '', currency: 'INR', commissionRate: 20, defaultLanguage: 'en' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login?next=/dashboard/superadmin/settings');
      return;
    }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    api<PlatformEnv>('/admin/platform/env').then(setEnv).catch(() => setEnv(null));
    api<PlatformSettingsValues>('/admin/platform/settings')
      .then((s) => {
        setSettings(s);
        setForm({ supportEmail: s.supportEmail, currency: s.currency, commissionRate: s.commissionRate, defaultLanguage: s.defaultLanguage });
      })
      .catch(() => setSettings(null));
  }, [user, loading, router]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const saved = await api<PlatformSettingsValues>('/admin/platform/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setSettings(saved);
      setMsg('Platform defaults saved — they now act as the fallback for every workspace.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !env) {
    return (
      <SuperAdminShell>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-line/60" />
          ))}
        </div>
        <div className="mt-6 h-72 animate-pulse rounded-2xl bg-line/60" />
      </SuperAdminShell>
    );
  }

  const isOverridden = (key: string) => settings?.overridden.includes(key);

  return (
    <SuperAdminShell>
      <BackLink href="/dashboard/superadmin" label="Platform console" />
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Platform Settings</h1>
        <p className="mt-1 text-[15px] text-muted">
          Global settings, environment, and platform-level configuration.
        </p>
      </div>

      {msg && <p className="mt-4 rounded-xl bg-green-500/10 px-4 py-2.5 text-sm text-green-600">{msg}</p>}
      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{err}</p>}

      {/* Environment */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold text-ink">
            <Server className="h-4.5 w-4.5 text-brand" /> Environment
          </h2>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize ${ENV_TINT[env.app.env] ?? 'bg-line/40 text-muted'}`}>
            {env.app.env}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTile icon={HardDrive} label="Node runtime" value={env.app.nodeVersion} hint={`API running for ${Math.floor(env.app.uptimeSeconds / 60)} min`} />
          <InfoTile icon={Database} label="API origin" value={`${env.app.apiUrl.replace(/^https?:\/\//, '')}:${env.app.apiPort}`} hint={`Frontend: ${env.app.webUrl.replace(/^https?:\/\//, '')}`} />
          <InfoTile icon={Globe} label="OAuth callback base" value={env.app.apiUrl.replace(/^https?:\/\//, '')} hint="Prefix in your OAuth app settings" />
          <InfoTile icon={ShieldCheck} label="File storage" value={env.storage.driver} hint={env.storage.driver === 'local' ? 'Local disk — switch to S3 via .env' : `S3 bucket ${env.storage.s3.bucket}`} />
        </div>
      </section>

      {/* Integrations */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="font-bold text-ink">Integrations</h2>
        <p className="mt-0.5 text-[13px] text-muted">
          Set the matching .env variables to activate. Keys are masked — they are never shown in full.
          Razorpay also accepts database overrides from the payment-gateways page.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Course checkout */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <CreditCard className="h-4 w-4 text-brand" /> Course checkout
              </p>
              <StatusBadge
                ok={env.payments.courseCheckout.stripe.configured || env.payments.courseCheckout.razorpay.enabled || env.payments.courseCheckout.paypal.configured}
                okLabel="Active"
              />
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted">Stripe {env.payments.courseCheckout.stripe.mode ? `(${env.payments.courseCheckout.stripe.mode})` : ''}</span>
                <span className="flex items-center gap-2 font-mono text-xs text-ink">
                  {env.payments.courseCheckout.stripe.masked || '—'}
                  {env.payments.courseCheckout.stripe.configured ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted" />}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted">Razorpay</span>
                <span className="flex items-center gap-2 font-mono text-xs text-ink">
                  {env.payments.courseCheckout.razorpay.keyId || '—'}
                  {env.payments.courseCheckout.razorpay.enabled ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted" />}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted">PayPal {env.payments.courseCheckout.paypal.configured ? `(${env.payments.courseCheckout.paypal.mode})` : ''}</span>
                <span className="flex items-center gap-2 font-mono text-xs text-ink">
                  {env.payments.courseCheckout.paypal.masked || '—'}
                  {env.payments.courseCheckout.paypal.configured ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted" />}
                </span>
              </li>
            </ul>
          </div>

          {/* Platform billing webhook */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink">Platform billing (Stripe webhook)</p>
              <StatusBadge ok={env.payments.platformBillingWebhook.configured} okLabel="Active" />
            </div>
            <p className="mt-3 font-mono text-xs text-ink">{env.payments.platformBillingWebhook.masked || 'STRIPE_PLATFORM_WEBHOOK_SECRET missing'}</p>
            <p className="mt-2 text-xs text-muted">Separate signing secret for plan-subscription events — keeps provider webhooks from being confused with course checkouts.</p>
          </div>

          {/* Mail */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <Mail className="h-4 w-4 text-brand" /> Mail delivery
              </p>
              <StatusBadge ok={env.mail.configured} okLabel={env.mail.configured ? 'SMTP ready' : 'SMTP credentials needed'} />
            </div>
            <p className="mt-3 text-sm text-ink">{env.mail.host || 'MAIL_HOST not set'} · port {env.mail.port}</p>
            <p className="mt-1 text-xs text-muted">From: {env.mail.from}</p>
          </div>

          {/* Social login */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink">Social login</p>
              <span className="text-xs text-muted">Empty keys = button hidden</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { name: 'Google', ok: env.oauth.google.configured, env: 'GOOGLE_CLIENT_ID / SECRET' },
                { name: 'GitHub', ok: env.oauth.github.configured, env: 'GITHUB_CLIENT_ID / SECRET' },
              ].map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-3">
                  <span className="text-muted">{p.name}</span>
                  <StatusBadge ok={p.ok} okLabel={p.env} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Editable platform defaults */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="font-bold text-ink">Platform defaults</h2>
        <p className="mt-0.5 text-[13px] text-muted">
          Stored in the database (keys `platform.*`) and used as the fallback wherever a workspace has no
          value of its own. Saved instantly — no API restart needed.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label">Fallback currency</label>
            <select className="input" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
              {['USD', 'EUR', 'GBP', 'INR', 'AED'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Default commission rate %</label>
            <input
              type="number" min={0} max={100} className="input"
              value={form.commissionRate}
              onChange={(e) => setForm((f) => ({ ...f, commissionRate: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">Default language</label>
            <select className="input" value={form.defaultLanguage} onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}>
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="fr">Français (French)</option>
              <option value="es">Español (Spanish)</option>
            </select>
          </div>
          <div>
            <label className="label">Support email</label>
            <input
              type="email" placeholder="support@example.com" className="input"
              value={form.supportEmail}
              onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
            />
            <p className="mt-1 text-xs text-muted">Empty = falls back to .env defaults</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save defaults'}</button>
          {isOverridden('currency') && <span className="badge">currency · DB override</span>}
          {isOverridden('commissionRate') && <span className="badge">commissionRate · DB override</span>}
          {isOverridden('defaultLanguage') && <span className="badge">defaultLanguage · DB override</span>}
          {isOverridden('supportEmail') && <span className="badge">supportEmail · DB override</span>}
        </div>
      </section>
    </SuperAdminShell>
  );
}
