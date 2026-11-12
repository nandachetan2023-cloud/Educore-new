'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Download, TrendingUp } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';

interface Withdraw { id: number; amount: number; status: string; transactionId?: string | null; createdAt: string }
interface Earning {
  id: number;
  courseId: number;
  courseTitle: string;
  courseSlug: string;
  thumbnail?: string | null;
  amount: number;
  commissionRate: number;
  net: number;
  currency: string;
  invoiceId: string;
  status: string;
  createdAt: string;
}

export default function PayoutsPage() {
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const currency = branding?.currency ?? 'INR';
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

  const load = useCallback(() => {
    Promise.all([
      api<{ walletBalance: number }>('/dashboard/instructor'),
      api<Withdraw[]>('/payouts/withdraws'),
      api<Earning[]>('/dashboard/instructor/earnings'),
    ])
      .then(([s, w, e]) => { setBalance(s.walletBalance); setWithdraws(w ?? []); setEarnings(e ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') { router.push('/login?next=/dashboard/instructor/payouts'); return; }
    load();
  }, [user, authLoading, router, load]);

  const pending = withdraws.filter((w) => w.status === 'pending').reduce((n, w) => n + w.amount, 0);
  const available = Math.max(0, balance - pending);
  const requested = amount === '' ? 0 : Number(amount);
  const tooMuch = requested > available;

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (tooMuch) { setErr(`You can withdraw up to ${money(available)} right now.`); return; }
    setBusy(true);
    try {
      await api('/payouts/withdraws', { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) });
      setMsg('Withdrawal requested. An admin will review it.');
      setAmount('');
      load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? `${e2.message} (HTTP ${e2.status})` : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const statusColor = (s: string) => s === 'approved' ? 'bg-green-500/15 text-green-600' : s === 'rejected' ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-600';

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard/instructor" className="text-sm text-muted hover:text-brand">← Back to dashboard</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Payouts</h1>

      {/* Balance summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-muted">Available balance</div>
          <div className="mt-1 text-2xl font-extrabold">{money(available)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted">Pending requests</div>
          <div className="mt-1 text-2xl font-extrabold text-amber-600">{money(pending)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted">Lifetime earnings</div>
          <div className="mt-1 text-2xl font-extrabold text-green-600">{money(earnings.reduce((n, e) => n + e.net, 0))}</div>
        </div>
      </div>

      {/* Request form */}
      <form onSubmit={request} className="card mt-6 p-6">
        <h2 className="font-bold">Request a withdrawal</h2>
        <p className="mt-1 text-sm text-muted">
          {available > 0
            ? `You can withdraw up to ${money(available)}. Funds land after an admin approves the request.`
            : 'Your wallet is empty — earnings appear here once a learner buys one of your courses.'}
        </p>
        <div className="mt-4 flex gap-3">
          <input
            type="number"
            min="1"
            max={available}
            step="0.01"
            required
            disabled={available <= 0}
            className="input"
            placeholder={available > 0 ? `Amount (max ${money(available)})` : 'No balance available'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className="btn-primary shrink-0" disabled={busy || available <= 0 || tooMuch}>
            {busy ? 'Requesting…' : 'Request'}
          </button>
        </div>
        {tooMuch && <p className="mt-2 text-sm text-red-500">That is more than your available balance ({money(available)}).</p>}
        {msg && <p className="mt-3 text-sm text-green-600">{msg}</p>}
        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
      </form>

      {/* Withdrawal history */}
      <h2 className="mt-10 text-xl font-bold">Withdrawal history</h2>
      {withdraws.length === 0 ? (
        <div className="card mt-4 p-10 text-center text-muted">
          No withdrawals yet. {available > 0 ? 'Request one above.' : 'Request a withdrawal once your course earns its first sale.'}
        </div>
      ) : (
        <div className="card mt-4 divide-y divide-line">
          {withdraws.map((w) => (
            <div key={w.id} className="flex items-center justify-between p-5">
              <div>
                <div className="font-semibold">{money(w.amount)}</div>
                <div className="text-sm text-muted">
                  {new Date(w.createdAt).toLocaleDateString()}{w.transactionId ? ` · ${w.transactionId}` : ''}
                </div>
              </div>
              <span className={`badge ${statusColor(w.status)}`}>{w.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Earnings history */}
      <h2 className="mt-10 text-xl font-bold">Earnings history</h2>
      {earnings.length === 0 ? (
        <div className="card mt-4 p-10 text-center text-muted">
          No sales yet — earnings from your course sales show up here.
        </div>
      ) : (
        <div className="card mt-4 divide-y divide-line">
          {earnings.map((e) => (
            <div key={e.id} className="flex items-center gap-4 p-5">
              <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
                <img src={e.thumbnail || `https://picsum.photos/seed/educore-${e.courseId}/320/180`} alt="" loading="lazy" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{e.courseTitle}</div>
                <div className="text-sm text-muted">
                  {new Date(e.createdAt).toLocaleDateString()} · {e.invoiceId} · {e.commissionRate}% commission
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-600">+{money(e.net)}</div>
                <div className="text-xs text-muted">of {money(e.amount)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-muted">
        <TrendingUp className="h-3.5 w-3.5" /> Your share is the sale price minus the platform commission.
      </p>
      <p className="mt-2 flex items-center gap-2 text-xs text-muted">
        <Clock className="h-3.5 w-3.5" /> Payouts are reviewed by a workspace admin and marked paid once processed.
        <Download className="h-3.5 w-3.5" />
      </p>
    </div>
  );
}
