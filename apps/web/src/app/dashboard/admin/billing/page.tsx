'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { PlanRow } from '@/lib/types';

interface MyBilling {
  subscription: {
    status: string;
    stripeCustomerId?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
    plan: PlanRow;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  incomplete: 'Incomplete',
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
};

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [tenant, setTenant] = useState<MyBilling | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([api<MyBilling>('/billing/me'), api<PlanRow[]>('/admin/plans')])
      .then(([me, planRows]) => { setTenant(me); setPlans(planRows); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load billing info'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/billing'); return; }
    if (user.adminRole === 'super_admin') { router.push('/dashboard/superadmin'); return; }
    load();
  }, [user, authLoading]);

  const checkout = async () => {
    setBusy(true); setErr(null);
    try {
      const { url } = await api<{ url: string }>('/billing/checkout', { method: 'POST' });
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to start checkout');
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true); setErr(null);
    try {
      const { url } = await api<{ url: string }>('/billing/portal', { method: 'POST' });
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to open billing portal');
      setBusy(false);
    }
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const sub = tenant?.subscription;
  const plan = sub?.plan;
  const success = params.get('success');
  const canceled = params.get('canceled');
  const hasStripeCustomer = !!sub?.stripeCustomerId;
  const planHasPrice = !!plan?.stripePriceId;

  return (
    <div className="container-page max-w-2xl py-10">
      <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Billing</h1>
      <p className="mt-1 text-muted">Your subscription to the platform.</p>

      {success && <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">Subscription updated — this can take a few seconds to reflect below.</p>}
      {canceled && <p className="mt-4 rounded-lg bg-gray-500/10 px-3 py-2 text-sm text-muted">Checkout canceled.</p>}
      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="card mt-6 p-6">
        {plan ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{plan.name}</div>
                <div className="text-sm text-muted">
                  ${(plan.priceMonthly / 100).toFixed(2)}/mo · {plan.currency.toUpperCase()}
                </div>
              </div>
              <span className={`badge ${sub?.status === 'active' || sub?.status === 'trialing' ? 'bg-green-500/15 text-green-600' : 'bg-amber-500/15 text-amber-600'}`}>
                {STATUS_LABEL[sub?.status ?? ''] ?? sub?.status}
              </span>
            </div>

            {sub?.currentPeriodEnd && (
              <p className="mt-3 text-sm text-muted">
                {sub.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on {new Date(sub.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              {hasStripeCustomer ? (
                <button onClick={openPortal} disabled={busy} className="btn-primary">
                  {busy ? 'Opening…' : 'Manage billing'}
                </button>
              ) : planHasPrice ? (
                <button onClick={checkout} disabled={busy} className="btn-primary">
                  {busy ? 'Starting…' : 'Subscribe with Stripe'}
                </button>
              ) : (
                <p className="text-sm text-muted">This plan isn't set up for online billing yet — contact the platform operator.</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted">No plan assigned yet — contact the platform operator.</p>
        )}
      </div>

      {plans.length > 0 && (
        <div className="mt-8">
          <h2 className="font-bold">Available plans</h2>
          <div className="card mt-3 divide-y divide-line">
            {plans.filter((p) => p.isActive).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-muted">${(p.priceMonthly / 100).toFixed(2)}/mo · {p.currency.toUpperCase()}</div>
                </div>
                {plan?.id === p.id && <span className="badge bg-brand/15 text-brand">Current</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
