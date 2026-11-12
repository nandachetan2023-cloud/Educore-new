'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';

interface SsoConfig {
  tenantId: number;
  enabled: boolean;
  label: string | null;
  metadataUrl: string | null;
  entryPoint: string | null;
  issuer: string | null;
  cert: string | null;
  spMetadataUrl?: string | null;
  acsUrl?: string | null;
  loginUrl?: string | null;
}

const EMPTY: SsoConfig = {
  tenantId: 0,
  enabled: false,
  label: null,
  metadataUrl: null,
  entryPoint: null,
  issuer: null,
  cert: null,
};

export default function AdminSsoPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<SsoConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin' || user.adminRole === 'super_admin') {
      router.push('/login?next=/dashboard/admin/sso');
      return;
    }
    api<SsoConfig>('/auth/saml/config')
      .then(setConfig)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Could not load SSO settings'))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const saved = await api<SsoConfig>('/auth/saml/config', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: config.enabled,
          label: config.label || null,
          metadataUrl: config.metadataUrl || null,
          entryPoint: config.entryPoint || null,
          issuer: config.issuer || null,
          cert: config.cert || null,
        }),
      });
      setConfig((c) => ({ ...c, ...saved }));
      setMsg('Single sign-on settings saved.');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not save SSO settings');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setErr('Could not copy to clipboard');
    }
  };

  if (authLoading || loading) {
    return <div className="container-page py-20 text-center text-muted">Loading…</div>;
  }

  return (
    <DirectoryShell
      eyebrow="Admin Console"
      sections={[
        {
          heading: 'Workspace',
          links: [
            { href: '/dashboard/admin/sso', label: 'Single sign-on', icon: ShieldCheck },
            { href: '/dashboard/admin/users', label: 'Users & Directory', icon: ShieldCheck },
            { href: '/dashboard/admin', label: 'Back to Console', icon: LayoutDashboard, match: '' },
          ],
        },
      ]}
      userName={user?.name ?? 'Admin'}
      userCaption="Tenant admin"
      userImage={user?.image}
      onLogout={logout}
    >
      <div style={{ fontFamily: 'var(--font-admin-body)' }}>
        <div className="mx-auto max-w-[720px]">
          <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
          <h1 className="mb-1 mt-2 text-[27px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-admin-display)' }}>
            Single sign-on (SAML 2.0)
          </h1>
          <p className="mb-6 text-sm text-muted">
            Let your learners sign in with your company identity provider. Paste the IdP metadata URL —
            we fetch the entry point and signing certificate and keep them up to date.
          </p>

          <form onSubmit={save} className="space-y-5 rounded-2xl border border-[#EAE6DB] bg-white p-6 shadow-sm">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-line accent-brand"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">Enable SAML sign-in</span>
                <span className="block text-xs text-muted">Shows a single sign-on option for this workspace.</span>
              </span>
            </label>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Button label</label>
              <input
                className="input"
                placeholder="Sign in with Okta"
                value={config.label ?? ''}
                onChange={(e) => setConfig({ ...config, label: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">IdP metadata URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://your-idp.example.com/app/…/sso/saml/metadata"
                value={config.metadataUrl ?? ''}
                onChange={(e) => setConfig({ ...config, metadataUrl: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted">
                Must be HTTPS. The entry point and certificate below are filled automatically on save.
              </p>
            </div>

            <details className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Advanced — manual entry point and certificate
              </summary>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">SSO entry point (redirect URL)</label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://your-idp.example.com/sso/saml"
                    value={config.entryPoint ?? ''}
                    onChange={(e) => setConfig({ ...config, entryPoint: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">SP entity ID override (optional)</label>
                  <input
                    type="url"
                    className="input"
                    placeholder="Leave blank to use the metadata URL"
                    value={config.issuer ?? ''}
                    onChange={(e) => setConfig({ ...config, issuer: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">IdP signing certificate (PEM or base64)</label>
                  <textarea
                    className="input min-h-[110px] font-mono text-xs"
                    placeholder="MIID…"
                    value={config.cert ?? ''}
                    onChange={(e) => setConfig({ ...config, cert: e.target.value })}
                  />
                </div>
              </div>
            </details>

            {err && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{err}</p>}
            {msg && <p className="rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-700">{msg}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? 'Saving…' : 'Save SSO settings'}
              </button>
              <button type="button" onClick={() => router.push('/dashboard/admin')} className="btn-ghost">
                Cancel
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-2xl border border-[#EAE6DB] bg-[#FAF8F2] p-5 text-sm">
            <p className="font-semibold text-ink">Give these to your identity provider</p>
            <p className="mt-1 text-xs text-muted">
              In your IdP create a SAML app, then paste the metadata URL below (or upload the XML) and set the
              ACS/Reply URL to the callback shown.
            </p>
            <ReadonlyRow label="SP metadata URL" value={config.spMetadataUrl} copied={copied} onCopy={copy} />
            <ReadonlyRow label="ACS / Reply URL" value={config.acsUrl} copied={copied} onCopy={copy} />
          </div>
        </div>
      </div>
    </DirectoryShell>
  );
}

function ReadonlyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value?: string | null;
  copied: string | null;
  onCopy: (v?: string | null) => void;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-xs">{value ?? 'Save the configuration first'}</code>
        <button
          type="button"
          onClick={() => onCopy(value)}
          disabled={!value}
          title="Copy"
          className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-ink disabled:opacity-40"
        >
          {value && copied === value ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
