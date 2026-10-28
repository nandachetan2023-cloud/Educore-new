'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';

interface Payout { id: number; amount: number; status: 'pending' | 'paid'; note?: string; createdAt: string }
interface Reseller {
  id: number; name: string; email: string; phone?: string; companyName?: string;
  commissionRate: number; status: 'active' | 'suspended'; totalEarned: number; payouts: Payout[];
}

const money = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function ResellersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Reseller[] | null>(null);
  const [form, setForm] = useState({ name: '', email: '', companyName: '', phone: '', commissionRate: 20 });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin' || user.adminRole !== 'super_admin') {
      router.push('/login?next=/dashboard/superadmin/resellers');
      return;
    }
    load();
  }, [user, authLoading]);

  const load = useCallback(() => {
    api<Reseller[]>('/admin/resellers').then(setRows).catch(() => setRows([]));
  }, []);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim()) { setErr('Name and email are required.'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/admin/resellers', { method: 'POST', body: JSON.stringify({ ...form, commissionRate: Number(form.commissionRate) }) });
      setForm({ name: '', email: '', companyName: '', phone: '', commissionRate: 20 });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create reseller');
    } finally { setBusy(false); }
  };

  const setStatus = async (id: number, status: 'active' | 'suspended') => {
    await api(`/admin/resellers/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this reseller permanently?')) return;
    await api(`/admin/resellers/${id}`, { method: 'DELETE' });
    load();
  };

  const payout = async (r: Reseller) => {
    const input = prompt(`Commission payout amount for ${r.name} (USD):`, '0');
    const amount = Number(input);
    if (!input || !Number.isFinite(amount) || amount <= 0) return;
    await api(`/admin/resellers/${r.id}/payouts`, { method: 'POST', body: JSON.stringify({ amount }) });
    load();
  };

  const settle = async (payoutId: number) => {
    await api(`/admin/resellers/payouts/${payoutId}/settle`, { method: 'PUT' });
    load();
  };

  return (
    <SuperAdminShell>
      <div className="container-page">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Resellers & partners</h1>
        <p className="mt-1 text-[15px] text-muted">Approve, suspend, set commission %, and settle payouts for partners who sell your plans.</p>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Reseller</th>
                  <th className="px-5 py-3">Commission</th>
                  <th className="px-5 py-3">Earned</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(rows ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-4">
                      <span className="block font-bold text-ink">{r.companyName || r.name}</span>
                      <span className="block text-xs text-muted">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span>
                      {r.payouts?.length > 0 && (
                        <span className="mt-1 block text-[11px] text-muted">
                          Last payout: {money(r.payouts[0].amount)} ({r.payouts[0].status})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-brand">{r.commissionRate}%</td>
                    <td className="px-5 py-4 font-semibold text-ink">{money(r.totalEarned)}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setStatus(r.id, r.status === 'active' ? 'suspended' : 'active')}
                        className={`badge ${r.status === 'active' ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500'}`}
                      >
                        {r.status}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => payout(r)} className="text-sm font-semibold text-brand hover:underline">Payout</button>
                      <button onClick={() => remove(r.id)} className="ml-3 text-red-500 hover:underline"><Trash2 size={15} className="inline" /></button>
                    </td>
                  </tr>
                ))}
                {rows?.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">No resellers yet — add your first partner.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card space-y-4 self-start p-6">
            <h2 className="flex items-center gap-2 font-bold text-ink"><Plus className="h-4 w-4 text-brand" /> Add reseller</h2>
            {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}
            <div><label className="label">Full name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Company</label><input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Commission %</label><input className="input" type="number" min="0" max="100" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })} /></div>
            <button onClick={create} disabled={busy} className="btn-primary w-full">{busy ? 'Saving…' : 'Create reseller'}</button>
          </div>
        </section>
      </div>
    </SuperAdminShell>
  );
}
