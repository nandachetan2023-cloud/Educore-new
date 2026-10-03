'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

interface RazorpaySettings {
  keyId: string;
  keySecret: string;
  enabled: boolean;
}

const MASK = '••••••••';

export default function PaymentSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<RazorpaySettings>({ keyId: '', keySecret: '', enabled: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') {
      router.push('/login?next=/dashboard/admin/settings/payment');
      return;
    }
    if (user.adminRole !== 'super_admin') {
      router.push('/dashboard/admin');
      return;
    }
    api<RazorpaySettings>('/admin/payment-settings')
      .then(setForm)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const payload = {
        keyId: form.keyId,
        keySecret: form.keySecret === MASK ? undefined : form.keySecret,
      };
      const saved = await api<RazorpaySettings>('/admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setForm(saved);
      setMsg('Razorpay settings saved.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await api<{ ok: boolean; keyId: string }>('/admin/payment-settings/razorpay/test', {
        method: 'POST',
      });
      setMsg(`Razorpay accepted the credentials for ${res.keyId}.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const clear = async () => {
    if (!confirm('Remove the stored Razorpay credentials? Checkout falls back to the RAZORPAY_* values in .env.')) {
      return;
    }
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const saved = await api<RazorpaySettings>('/admin/payment-settings', {
        method: 'PUT',
        body: JSON.stringify({ keyId: '', keySecret: '' }),
      });
      setForm(saved);
      setMsg('Stored Razorpay credentials removed.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to clear');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) {
    return <div className="container-page py-20 text-center text-muted">Loading…</div>;
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <Link href="/dashboard/superadmin" className="text-sm text-muted hover:text-brand">
        ← Platform console
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">Payment configuration</h1>
      <p className="mt-1 text-muted">
        Add your buyer-facing payment gateway credentials. These are stored in the database and take effect
        immediately — no API restart needed. If a field is left empty the platform falls back to the matching
        <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs">RAZORPAY_*</code>
        value in the API&rsquo;s <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">.env</code>.
      </p>

      <div className="card mt-6 space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Razorpay / UPI</h2>
          <span className={`badge ${form.enabled ? 'bg-green-500/15 text-green-600' : 'bg-amber-500/15 text-amber-600'}`}>
            {form.enabled ? 'Active' : 'Not configured'}
          </span>
        </div>

        <p className="-mt-3 text-sm text-muted">
          Supports cards, netbanking, UPI and wallets. Use test keys while developing — they are
          <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 text-xs">rzp_test_</code>
          prefixed. Live keys charge real money.
        </p>

        <div>
          <label className="label">Key ID</label>
          <input
            className="input font-mono"
            placeholder="rzp_test_xxxxxxxxxxxxxxxx"
            value={form.keyId}
            onChange={(e) => setForm((f) => ({ ...f, keyId: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Key secret</label>
          <input
            type="password"
            className="input font-mono"
            placeholder="••••••••"
            value={form.keySecret}
            onChange={(e) => setForm((f) => ({ ...f, keySecret: e.target.value }))}
          />
        </div>

        {msg && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{msg}</p>}
        {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

        <div className="flex flex-wrap gap-3">
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button onClick={test} disabled={testing || !form.enabled} className="btn-ghost">
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button onClick={clear} disabled={busy || !form.enabled} className="btn-ghost">
            Clear stored keys
          </button>
        </div>
      </div>

      <div className="card mt-6 border-amber-500/30 p-6">
        <h2 className="text-lg font-bold text-amber-600">Other gateways</h2>
        <p className="mt-1 text-sm text-muted">
          Stripe and PayPal are still configured through the API&rsquo;s <code>.env</code> only. This screen
          currently manages Razorpay credentials.
        </p>
      </div>
    </div>
  );
}