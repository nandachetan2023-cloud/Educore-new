'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';

interface Withdraw { id: number; amount: number; status: string; transactionId?: string; createdAt: string }

export default function PayoutsPage() {
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const currency = branding?.currency ?? 'USD';
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

  const load = useCallback(() => {
    Promise.all([
      api<{ walletBalance: number }>('/dashboard/instructor'),
      api<Withdraw[]>('/payouts/withdraws'),
    ]).then(([s, w]) => { setBalance(s.walletBalance); setWithdraws(w); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') { router.push('/login?next=/dashboard/instructor/payouts'); return; }
    load();
  }, [user, authLoading]);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    try {
      await api('/payouts/withdraws', { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) });
      setMsg('Withdrawal requested. An admin will review it.');
      setAmount('');
      load();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Request failed'); }
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const statusColor = (s: string) => s === 'approved' ? 'bg-green-500/15 text-green-600' : s === 'rejected' ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-600';

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard/instructor" className="text-sm text-muted hover:text-brand">← Back to dashboard</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Payouts</h1>

      <div className="card mt-6 flex items-center justify-between p-6">
        <div>
          <div className="text-sm text-muted">Available balance</div>
          <div className="mt-1 text-3xl font-extrabold">{money(balance)}</div>
        </div>
        <div className="text-4xl">💰</div>
      </div>

      <form onSubmit={request} className="card mt-6 p-6">
        <h2 className="font-bold">Request a withdrawal</h2>
        <div className="mt-4 flex gap-3">
          <input type="number" min="1" step="0.01" required className="input" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn-primary shrink-0">Request</button>
        </div>
        {msg && <p className="mt-3 text-sm text-green-600">{msg}</p>}
        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
      </form>

      <h2 className="mt-10 text-xl font-bold">History</h2>
      {withdraws.length === 0 ? (
        <div className="card mt-4 p-10 text-center text-muted">No withdrawals yet.</div>
      ) : (
        <div className="card mt-4 divide-y divide-line">
          {withdraws.map((w) => (
            <div key={w.id} className="flex items-center justify-between p-5">
              <div>
                <div className="font-semibold">{money(w.amount)}</div>
                <div className="text-sm text-muted">{new Date(w.createdAt).toLocaleDateString()} {w.transactionId ? `· ${w.transactionId}` : ''}</div>
              </div>
              <span className={`badge ${statusColor(w.status)}`}>{w.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
