'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Globe, Palette } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';
import { TenantStatusBadge } from '@/components/tenant-status-badge';
import { ImageUpload } from '@/components/image-upload';
import type { TenantRow, Branding } from '@/lib/types';

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

export default function TenantDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [domain, setDomain] = useState<DomainInfo | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainMsg, setDomainMsg] = useState<string | null>(null);
  const [domainErr, setDomainErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // White-label branding for this tenant's admin (managed on their behalf).
  const [brand, setBrand] = useState<Branding | null>(null);
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandMsg, setBrandMsg] = useState<string | null>(null);
  const [brandErr, setBrandErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<TenantRow>(`/admin/tenants/${params.id}`).then(setTenant).catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load tenant'));
    api<DomainInfo>(`/admin/tenants/${params.id}/domain`).then((d) => { setDomain(d); setDomainInput(d.customDomain ?? ''); }).catch(() => {});
    api<Branding>(`/admin/tenants/${params.id}/branding`).then(setBrand).catch(() => {});
  }, [params.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(`/login?next=/dashboard/superadmin/tenants/${params.id}`); return; }
    if (user.principal !== 'admin' || user.adminRole !== 'super_admin') { router.push('/dashboard'); return; }
    load();
  }, [user, authLoading]);

  const toggleSuspend = async () => {
    if (!tenant) return;
    setBusy(true);
    setErr(null);
    try {
      const action = tenant.status === 'suspended' ? 'reactivate' : 'suspend';
      await api(`/admin/tenants/${tenant.id}/${action}`, { method: 'POST' });
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const setDomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setDomainBusy(true); setDomainMsg(null); setDomainErr(null);
    try {
      const d = await api<DomainInfo>(`/admin/tenants/${tenant.id}/domain`, { method: 'POST', body: JSON.stringify({ domain: domainInput }) });
      setDomain(d);
      setDomainMsg('Domain saved — add the DNS record below, then verify.');
    } catch (e) {
      setDomainErr(e instanceof ApiError ? e.message : 'Failed to save domain');
    } finally {
      setDomainBusy(false);
    }
  };

  const verifyDomain = async () => {
    if (!tenant) return;
    setDomainBusy(true); setDomainMsg(null); setDomainErr(null);
    try {
      const d = await api<DomainInfo>(`/admin/tenants/${tenant.id}/domain/verify`, { method: 'POST' });
      setDomain(d);
      setDomainMsg(d.domainStatus === 'verified' ? 'Domain verified!' : "Couldn't find that TXT record yet — DNS changes can take a while to propagate. Try again shortly.");
    } catch (e) {
      setDomainErr(e instanceof ApiError ? e.message : 'Failed to verify domain');
    } finally {
      setDomainBusy(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});

  const saveBrand = async () => {
    if (!tenant || !brand) return;
    setBrandBusy(true); setBrandMsg(null); setBrandErr(null);
    try {
      const updated = await api<Branding>(`/admin/tenants/${tenant.id}/branding`, {
        method: 'PUT',
        body: JSON.stringify({ ...brand, commissionRate: String(brand.commissionRate) }),
      });
      setBrand(updated);
      setBrandMsg('White-label settings saved for this admin.');
    } catch (e) {
      setBrandErr(e instanceof ApiError ? e.message : 'Failed to save branding');
    } finally {
      setBrandBusy(false);
    }
  };

  const resetBrand = async () => {
    if (!tenant) return;
    if (!confirm('Reset this workspace branding to platform defaults?')) return;
    setBrandBusy(true); setBrandMsg(null); setBrandErr(null);
    try {
      const updated = await api<Branding>(`/admin/tenants/${tenant.id}/branding/reset`, { method: 'PUT' });
      setBrand(updated);
      setBrandMsg('Branding reset to platform defaults.');
    } catch (e) {
      setBrandErr(e instanceof ApiError ? e.message : 'Failed to reset branding');
    } finally {
      setBrandBusy(false);
    }
  };

  if (authLoading || !tenant) return <div className="container-page py-20 text-center text-muted">{err ?? 'Loading…'}</div>;

  const domainStatus = domain?.domainStatus ?? 'none';

  return (
    <SuperAdminShell>
      <Link href="/dashboard/superadmin/tenants" className="flex items-center gap-1.5 text-sm text-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Sub-accounts
      </Link>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">{tenant.name}</h1>
          <p className="mt-1 text-sm text-muted">/{tenant.slug}</p>
        </div>
        <TenantStatusBadge status={tenant.status} />
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{err}</p>}

      <div className="mt-6 space-y-3 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <Row label="Owner" value={`${tenant.owner.name} (${tenant.owner.email})`} />
        <Row label="Plan" value={tenant.subscription ? `${tenant.subscription.plan.name} — $${(tenant.subscription.plan.priceMonthly / 100).toFixed(2)}/mo` : 'None'} />
        <Row label="Subscription status" value={tenant.subscription?.status ?? 'none'} />
        <Row label="Created" value={new Date(tenant.createdAt).toLocaleString()} />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Globe className="h-5 w-5 text-brand" /> Custom domain</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${DOMAIN_STATUS_STYLE[domainStatus]}`}>{DOMAIN_STATUS_LABEL[domainStatus]}</span>
        </div>
        <p className="mt-1 text-sm text-muted">Serve this tenant's site on its own domain instead of the shared platform URL.</p>

        {domainMsg && <p className="mt-4 rounded-xl bg-green-500/10 px-4 py-2.5 text-sm text-green-600">{domainMsg}</p>}
        {domainErr && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{domainErr}</p>}

        <form onSubmit={setDomainSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            required
            className="input flex-1"
            placeholder="learn.tenantbrand.com"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
          />
          <button disabled={domainBusy} className="btn-primary shrink-0 rounded-full px-6">
            {domainBusy ? 'Saving…' : domain?.customDomain ? 'Change' : 'Set domain'}
          </button>
        </form>

        {domain?.verificationRecord && domainStatus !== 'verified' && (
          <div className="mt-5 space-y-3 border-t border-line pt-5">
            <p className="text-sm text-muted">
              Add this TXT record at the domain's DNS provider, then verify. DNS changes can take anywhere from a
              few minutes to a few hours to propagate.
            </p>
            <DnsField label="Type" value={domain.verificationRecord.type} onCopy={copy} />
            <DnsField label="Name / Host" value={domain.verificationRecord.name} onCopy={copy} />
            <DnsField label="Value" value={domain.verificationRecord.value} onCopy={copy} />
            <button onClick={verifyDomain} disabled={domainBusy} className="btn-primary rounded-full px-6">
              {domainBusy ? 'Checking…' : 'Verify domain'}
            </button>
          </div>
        )}

        {domainStatus === 'verified' && (
          <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
            Ownership verified. Point <strong>{domain?.customDomain}</strong>'s A/CNAME record at your hosting to
            start serving traffic there — TLS/SSL setup is a separate infrastructure step, not handled here.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><Palette className="h-5 w-5 text-brand" /> White label — admin branding</h2>
        <p className="mt-1 text-sm text-muted">This tenant admin's brand identity: name, logo, colors, currency and commission. Same settings the admin sees under White label.</p>

        {brandMsg && <p className="mt-4 rounded-xl bg-green-500/10 px-4 py-2.5 text-sm text-green-600">{brandMsg}</p>}
        {brandErr && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{brandErr}</p>}

        {brand ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className="label">Company / brand name</label>
              <input className="input" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} placeholder="Tenant Brand" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUpload label="Logo" value={brand.logo} onChange={(v) => setBrand({ ...brand, logo: v })} />
              <ImageUpload label="Favicon" value={brand.favicon} onChange={(v) => setBrand({ ...brand, favicon: v })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Primary accent</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={brand.primaryColor} onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-card" />
                  <input className="input" value={brand.primaryColor} onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Secondary accent</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={brand.secondaryColor} onChange={(e) => setBrand({ ...brand, secondaryColor: e.target.value })} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-card" />
                  <input className="input" value={brand.secondaryColor} onChange={(e) => setBrand({ ...brand, secondaryColor: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Currency</label>
                <select className="input" value={brand.currency} onChange={(e) => setBrand({ ...brand, currency: e.target.value })}>
                  {['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'AED', 'SGD'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Platform commission (%)</label>
                <input type="number" min="0" max="100" className="input" value={brand.commissionRate}
                  onChange={(e) => setBrand({ ...brand, commissionRate: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={saveBrand} disabled={brandBusy} className="btn-primary rounded-full px-6 disabled:opacity-60">
                {brandBusy ? 'Saving…' : 'Save white label'}
              </button>
              <button onClick={resetBrand} disabled={brandBusy} className="btn-ghost rounded-full px-6">
                Reset to defaults
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Loading branding…</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-ink">Access</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Suspending immediately blocks this tenant's admin, instructors, and students from logging in or using
          already-issued sessions — enforced on every request, not just at login.
        </p>
        <button
          onClick={toggleSuspend}
          disabled={busy}
          className={`mt-4 inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 ${tenant.status === 'suspended' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {busy ? 'Working…' : tenant.status === 'suspended' ? 'Reactivate workspace' : 'Suspend workspace'}
        </button>
      </div>
    </SuperAdminShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-medium">{value}</span>
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
