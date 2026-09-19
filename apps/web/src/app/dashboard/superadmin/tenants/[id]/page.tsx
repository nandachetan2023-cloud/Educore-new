'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { TenantStatusBadge } from '@/components/tenant-status-badge';
import type { TenantRow } from '@/lib/types';

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

  const load = useCallback(() => {
    api<TenantRow>(`/admin/tenants/${params.id}`).then(setTenant).catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load tenant'));
    api<DomainInfo>(`/admin/tenants/${params.id}/domain`).then((d) => { setDomain(d); setDomainInput(d.customDomain ?? ''); }).catch(() => {});
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

  if (authLoading || !tenant) return <div className="container-page py-20 text-center text-muted">{err ?? 'Loading…'}</div>;

  const domainStatus = domain?.domainStatus ?? 'none';

  return (
    <div className="container-page max-w-2xl py-10">
      <Link href="/dashboard/superadmin/tenants" className="text-sm text-muted hover:text-brand">← Tenants</Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">{tenant.name}</h1>
        <TenantStatusBadge status={tenant.status} />
      </div>
      <p className="mt-1 text-muted">/{tenant.slug}</p>

      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="card mt-6 space-y-3 p-6">
        <Row label="Owner" value={`${tenant.owner.name} (${tenant.owner.email})`} />
        <Row label="Plan" value={tenant.subscription ? `${tenant.subscription.plan.name} — $${(tenant.subscription.plan.priceMonthly / 100).toFixed(2)}/mo` : 'None'} />
        <Row label="Subscription status" value={tenant.subscription?.status ?? 'none'} />
        <Row label="Created" value={new Date(tenant.createdAt).toLocaleString()} />
      </div>

      <div className="card mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Custom domain</h2>
          <span className={`badge ${DOMAIN_STATUS_STYLE[domainStatus]}`}>{DOMAIN_STATUS_LABEL[domainStatus]}</span>
        </div>
        <p className="mt-1 text-sm text-muted">Serve this tenant's site on its own domain instead of the shared platform URL.</p>

        {domainMsg && <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{domainMsg}</p>}
        {domainErr && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{domainErr}</p>}

        <form onSubmit={setDomainSubmit} className="mt-4 flex gap-3">
          <input
            required
            className="input flex-1"
            placeholder="learn.tenantbrand.com"
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
              Add this TXT record at the domain's DNS provider, then verify. DNS changes can take anywhere from a
              few minutes to a few hours to propagate.
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
            Ownership verified. Point <strong>{domain?.customDomain}</strong>'s A/CNAME record at your hosting to
            start serving traffic there — TLS/SSL setup is a separate infrastructure step, not handled here.
          </p>
        )}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="font-bold">Access</h2>
        <p className="mt-1 text-sm text-muted">
          Suspending immediately blocks this tenant's admin, instructors, and students from logging in or using
          already-issued sessions — enforced on every request, not just at login.
        </p>
        <button
          onClick={toggleSuspend}
          disabled={busy}
          className={`btn mt-4 px-4 py-2 text-sm text-white hover:brightness-110 ${tenant.status === 'suspended' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {busy ? 'Working…' : tenant.status === 'suspended' ? 'Reactivate tenant' : 'Suspend tenant'}
        </button>
      </div>
    </div>
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
