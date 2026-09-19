'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

type DomainStatus = 'none' | 'pending' | 'verified' | 'failed';

interface DomainInfo {
  customDomain: string | null;
  domainStatus: DomainStatus;
  verificationRecord: { name: string; type: string; value: string } | null;
}

const STATUS_STYLE: Record<DomainStatus, string> = {
  none: 'bg-gray-500/15 text-gray-500',
  pending: 'bg-amber-500/15 text-amber-600',
  failed: 'bg-red-500/15 text-red-500',
  verified: 'bg-green-500/15 text-green-600',
};

const STATUS_LABEL: Record<DomainStatus, string> = {
  none: 'Not set',
  pending: 'Pending verification',
  failed: 'Verification failed',
  verified: 'Verified',
};

export default function DomainPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [info, setInfo] = useState<DomainInfo | null>(null);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<DomainInfo>('/admin/domain')
      .then((d) => { setInfo(d); setDomain(d.customDomain ?? ''); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load domain info'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/domain'); return; }
    if (user.adminRole === 'super_admin') { router.push('/dashboard/superadmin'); return; }
    load();
  }, [user, authLoading]);

  const setDomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null); setErr(null);
    try {
      const d = await api<DomainInfo>('/admin/domain', { method: 'POST', body: JSON.stringify({ domain }) });
      setInfo(d);
      setMsg('Domain saved — add the DNS record below, then verify.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save domain');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const d = await api<DomainInfo>('/admin/domain/verify', { method: 'POST' });
      setInfo(d);
      setMsg(d.domainStatus === 'verified' ? 'Domain verified!' : "Couldn't find that TXT record yet — DNS changes can take a while to propagate. Try again shortly.");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to verify domain');
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const status = info?.domainStatus ?? 'none';

  return (
    <div className="container-page max-w-2xl py-10">
      <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Custom domain</h1>
      <p className="mt-1 text-muted">Serve your site on your own domain instead of the shared platform URL.</p>

      {msg && <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{msg}</p>}
      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="card mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">{info?.customDomain ?? 'No domain set'}</div>
          </div>
          <span className={`badge ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
        </div>

        <form onSubmit={setDomainSubmit} className="mt-6 flex gap-3">
          <input
            required
            className="input flex-1"
            placeholder="learn.yourbrand.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <button disabled={busy} className="btn-primary shrink-0">
            {busy ? 'Saving…' : info?.customDomain ? 'Change domain' : 'Set domain'}
          </button>
        </form>
      </div>

      {info?.verificationRecord && status !== 'verified' && (
        <div className="card mt-6 p-6">
          <h2 className="font-bold">Verify ownership</h2>
          <p className="mt-1 text-sm text-muted">
            Add this TXT record at your DNS provider, then click verify. DNS changes can take anywhere from a few
            minutes to a few hours to propagate.
          </p>

          <div className="mt-4 space-y-3">
            <DnsField label="Type" value={info.verificationRecord.type} onCopy={copy} />
            <DnsField label="Name / Host" value={info.verificationRecord.name} onCopy={copy} />
            <DnsField label="Value" value={info.verificationRecord.value} onCopy={copy} />
          </div>

          <button onClick={verify} disabled={busy} className="btn-primary mt-5">
            {busy ? 'Checking…' : 'Verify domain'}
          </button>
        </div>
      )}

      {status === 'verified' && (
        <div className="card mt-6 p-6">
          <p className="text-sm text-muted">
            Ownership verified. Point <strong>{info?.customDomain}</strong>'s A/CNAME record at your hosting to
            start serving traffic there — TLS/SSL setup for the custom domain is a separate infrastructure step,
            not handled here.
          </p>
        </div>
      )}
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
