'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { ImageUpload } from '@/components/image-upload';
import type { Branding } from '@/lib/types';

type DomainStatus = 'none' | 'pending' | 'verified' | 'failed';

interface DomainInfo {
  customDomain: string | null;
  domainStatus: DomainStatus;
  verificationRecord: { name: string; type: string; value: string } | null;
}

const DOMAIN_STATUS_STYLE: Record<DomainStatus, string> = {
  none: 'bg-gray-500/15 text-gray-500',
  pending: 'bg-amber-500/15 text-amber-600',
  failed: 'bg-red-500/15 text-red-500',
  verified: 'bg-green-500/15 text-green-600',
};

const DOMAIN_STATUS_LABEL: Record<DomainStatus, string> = {
  none: 'Not set',
  pending: 'Pending verification',
  failed: 'Verification failed',
  verified: 'Verified',
};

export default function WhiteLabelPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<Branding>({
    name: '', logo: '', favicon: '', primaryColor: '#4f46e5', secondaryColor: '#0ea5e9', currency: 'USD', commissionRate: 20,
  });
  const [domain, setDomain] = useState<DomainInfo | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [domainBusy, setDomainBusy] = useState(false);
  const [domainMsg, setDomainMsg] = useState<string | null>(null);
  const [domainErr, setDomainErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/white-label'); return; }
    Promise.all([
      api<Branding>('/admin/branding'),
      api<DomainInfo>('/admin/domain'),
    ]).then(([b, d]) => {
      setForm(b);
      setDomain(d);
      setDomainInput(d.customDomain ?? '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user, authLoading]);

  const set = (k: keyof Branding) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      await api('/admin/branding', {
        method: 'PUT',
        body: JSON.stringify({ ...form, commissionRate: String(form.commissionRate) }),
      });
      setMsg('Brand settings saved. Applying…');
      setTimeout(() => window.location.assign('/dashboard/admin/white-label'), 700);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!confirm('Reset all branding to the platform defaults?')) return;
    await api('/admin/branding/reset', { method: 'PUT' });
    window.location.assign('/dashboard/admin/white-label');
  };

  const setDomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDomainBusy(true); setDomainMsg(null); setDomainErr(null);
    try {
      const d = await api<DomainInfo>('/admin/domain', { method: 'POST', body: JSON.stringify({ domain: domainInput }) });
      setDomain(d);
      setDomainMsg('Domain saved — add the DNS record below, then verify.');
    } catch (e) {
      setDomainErr(e instanceof ApiError ? e.message : 'Failed to save domain');
    } finally {
      setDomainBusy(false);
    }
  };

  const verifyDomain = async () => {
    setDomainBusy(true); setDomainMsg(null); setDomainErr(null);
    try {
      const d = await api<DomainInfo>('/admin/domain/verify', { method: 'POST' });
      setDomain(d);
      setDomainMsg(d.domainStatus === 'verified' ? 'Domain verified!' : "Couldn't find that TXT record yet — DNS changes can take a while to propagate. Try again shortly.");
    } catch (e) {
      setDomainErr(e instanceof ApiError ? e.message : 'Failed to verify domain');
    } finally {
      setDomainBusy(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const domainStatus = domain?.domainStatus ?? 'none';
  const previewHost = domain?.customDomain || 'yourbrand.example.com';

  return (
    <div className="container-page max-w-6xl py-10">
      <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
      <h1 className="mt-3 text-3xl font-extrabold">White label</h1>
      <p className="mt-1 text-muted">Your brand identity and custom domain — how your students and instructors see this platform.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Brand Identity */}
          <div className="card space-y-6 p-6">
            <h2 className="font-bold">Brand identity</h2>

            <div>
              <label className="label">Company / brand name</label>
              <input className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="Your Brand" />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <ImageUpload label="Logo (PNG/JPG/SVG — shown in header & footer)" value={form.logo} onChange={set('logo')} />
              <ImageUpload label="Favicon (browser tab icon)" value={form.favicon} onChange={set('favicon')} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <ColorField label="Primary accent" value={form.primaryColor} onChange={set('primaryColor')} />
              <ColorField label="Secondary accent" value={form.secondaryColor} onChange={set('secondaryColor')} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label">Currency</label>
                <select className="input" value={form.currency} onChange={(e) => set('currency')(e.target.value)}>
                  {['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'AED', 'SGD'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Platform commission (%)</label>
                <input type="number" min="0" max="100" className="input" value={form.commissionRate}
                  onChange={(e) => setForm((f) => ({ ...f, commissionRate: Number(e.target.value) }))} />
              </div>
            </div>
          </div>

          {/* Custom Domain */}
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Custom domain</h2>
              <span className={`badge ${DOMAIN_STATUS_STYLE[domainStatus]}`}>{DOMAIN_STATUS_LABEL[domainStatus]}</span>
            </div>
            <p className="mt-1 text-sm text-muted">Serve your site on your own domain instead of the shared platform URL.</p>

            {domainMsg && <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{domainMsg}</p>}
            {domainErr && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{domainErr}</p>}

            <form onSubmit={setDomainSubmit} className="mt-4 flex gap-3">
              <input
                required
                className="input flex-1"
                placeholder="learn.yourbrand.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
              />
              <button disabled={domainBusy} className="btn-primary shrink-0">
                {domainBusy ? 'Saving…' : domain?.customDomain ? 'Change' : 'Set domain'}
              </button>
            </form>

            {domain?.verificationRecord && domainStatus !== 'verified' && (
              <div className="mt-5 space-y-3 border-t border-line pt-5">
                <p className="text-sm text-muted">
                  Add this TXT record at your DNS provider to prove ownership, then verify. DNS changes can take
                  anywhere from a few minutes to a few hours to propagate.
                </p>
                <DnsField label="Type" value={domain.verificationRecord.type} onCopy={copy} />
                <DnsField label="Name / Host" value={domain.verificationRecord.name} onCopy={copy} />
                <DnsField label="Value" value={domain.verificationRecord.value} onCopy={copy} />
                <button onClick={verifyDomain} disabled={domainBusy} className="btn-primary">
                  {domainBusy ? 'Checking…' : 'Verify domain'}
                </button>
              </div>
            )}

            {domainStatus === 'verified' && (
              <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
                Ownership verified — point <strong>{domain?.customDomain}</strong>'s A/CNAME record at your hosting
                to start serving traffic there. TLS/SSL certificate setup is a separate infrastructure step, not
                automated here.
              </p>
            )}
          </div>
        </div>

        {/* Right column: live preview + save/reset */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Live preview</h2>
          <div className="card overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-line bg-card px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="ml-2 flex-1 truncate rounded-md bg-line/60 px-2 py-1 text-[10px] text-muted">{previewHost}</span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                {form.logo ? (
                  <img src={form.logo} alt="" className="h-6 w-auto max-w-[90px] object-contain" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-md text-xs font-bold text-white" style={{ background: form.primaryColor }}>
                    {form.name?.[0] ?? 'Y'}
                  </span>
                )}
                <span className="truncate text-sm font-extrabold">{form.name || 'Your Brand'}</span>
              </div>
              <div className="mt-3 flex justify-end">
                <span className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white" style={{ background: form.primaryColor }}>
                  Action button
                </span>
              </div>
              <div className="mt-3 h-2.5 w-2/3 rounded bg-line/70" />
              <div className="mt-2 h-2.5 w-1/2 rounded bg-line/50" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="h-12 rounded-lg" style={{ background: `${form.primaryColor}22` }} />
                <div className="h-12 rounded-lg" style={{ background: `${form.secondaryColor}22` }} />
              </div>
            </div>
          </div>

          {msg && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{msg}</p>}
          {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

          <button onClick={save} disabled={busy} className="btn-primary w-full">{busy ? 'Saving…' : 'Save brand settings'}</button>
          <button onClick={reset} className="btn-ghost w-full">Reset to defaults</button>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-card" />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function DnsField({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <code className="input flex-1 overflow-x-auto whitespace-nowrap text-xs">{value}</code>
        <button type="button" onClick={() => onCopy(value)} className="btn-ghost shrink-0 px-3 py-2 text-sm">Copy</button>
      </div>
    </div>
  );
}
