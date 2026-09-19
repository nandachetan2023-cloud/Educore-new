'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';

interface CartItem {
  id: number;
  course: { id: number; title: string; slug: string; thumbnail?: string; price?: number; discount?: number; instructor: { name: string } };
}
interface CartResponse { items: CartItem[]; subtotal: number; count: number }
interface Gateways { stripe: boolean; paypal: boolean; razorpay: boolean; razorpayKeyId?: string }
type GatewayId = 'stripe' | 'paypal' | 'razorpay';

const GATEWAY_LABEL: Record<GatewayId, string> = { stripe: 'Card (Stripe)', paypal: 'PayPal', razorpay: 'Razorpay / UPI' };

/** Lazily injects Razorpay's checkout widget script (no npm package needed). */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [gateways, setGateways] = useState<Gateways | null>(null);
  const [gateway, setGateway] = useState<GatewayId>('stripe');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = branding?.currency ?? 'USD';
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

  const load = () => {
    api<CartResponse>('/cart').then(setCart).catch(() => setCart(null)).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/cart'); return; }
    load();
    api<Gateways>('/checkout/gateways', { auth: false }).then((g) => {
      setGateways(g);
      // Default to the first gateway that's actually configured.
      const first = (['stripe', 'paypal', 'razorpay'] as GatewayId[]).find((k) => g[k]);
      if (first) setGateway(first);
    }).catch(() => {});
  }, [user, authLoading]);

  const remove = async (id: number) => {
    await api(`/cart/${id}`, { method: 'DELETE' });
    load();
  };

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{
        free: boolean;
        orderId: number;
        checkoutUrl?: string;
        razorpay?: { keyId: string; razorpayOrderId: string; amount: number; currency: string };
      }>('/checkout', { method: 'POST', body: JSON.stringify({ gateway }) });

      if (res.free) {
        router.push(`/checkout/success?order=${res.orderId}`);
      } else if (gateway === 'razorpay' && res.razorpay) {
        await loadRazorpayScript();
        const rp = new (window as any).Razorpay({
          key: res.razorpay.keyId,
          order_id: res.razorpay.razorpayOrderId,
          amount: res.razorpay.amount,
          currency: res.razorpay.currency,
          name: 'Checkout',
          description: `Order #${res.orderId}`,
          handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await api(`/checkout/razorpay/${res.orderId}/verify`, {
                method: 'POST',
                body: JSON.stringify({
                  razorpayOrderId: resp.razorpay_order_id,
                  razorpayPaymentId: resp.razorpay_payment_id,
                  signature: resp.razorpay_signature,
                }),
              });
              router.push(`/checkout/success?order=${res.orderId}`);
            } catch (e) {
              setError(e instanceof ApiError ? e.message : 'Could not verify payment');
            } finally {
              setBusy(false);
            }
          },
          modal: { ondismiss: () => setBusy(false) },
        });
        rp.open();
        return; // busy is cleared by the handler/ondismiss callbacks above
      } else if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return; // navigating away
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Checkout failed');
    } finally {
      if (gateway !== 'razorpay') setBusy(false);
    }
  };

  if (loading || authLoading) return <div className="container-page py-20 text-center text-muted">Loading cart…</div>;

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-extrabold">Your cart</h1>

      {!cart || cart.items.length === 0 ? (
        <div className="card mt-8 p-16 text-center">
          <p className="text-muted">Your cart is empty.</p>
          <Link href="/courses" className="btn-primary mt-5">Browse courses</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {cart.items.map((item) => {
              const net = Math.max(0, (item.course.price ?? 0) - (item.course.discount ?? 0));
              return (
                <div key={item.id} className="card flex items-center gap-4 p-4">
                  <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-brand-soft">
                    {item.course.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.course.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-2xl font-black text-brand/30">{item.course.title[0]}</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <Link href={`/courses/${item.course.slug}`} className="font-semibold hover:text-brand">{item.course.title}</Link>
                    <p className="text-sm text-muted">{item.course.instructor.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{net === 0 ? 'Free' : fmt(net)}</div>
                    <button onClick={() => remove(item.id)} className="mt-1 text-sm text-red-500 hover:underline">Remove</button>
                  </div>
                </div>
              );
            })}
          </div>

          <aside>
            <div className="card sticky top-24 p-6">
              <h2 className="text-lg font-bold">Order summary</h2>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-muted">Subtotal ({cart.count} items)</span>
                <span className="font-semibold">{fmt(cart.subtotal)}</span>
              </div>
              <div className="mt-4 flex justify-between border-t border-line pt-4 text-lg font-bold">
                <span>Total</span>
                <span>{cart.subtotal === 0 ? 'Free' : fmt(cart.subtotal)}</span>
              </div>
              {cart.subtotal > 0 && gateways && (
                <div className="mt-5">
                  <div className="label">Payment method</div>
                  <div className="grid gap-2">
                    {(['stripe', 'paypal', 'razorpay'] as GatewayId[])
                      .filter((g) => gateways[g])
                      .map((g) => (
                        <label
                          key={g}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
                            gateway === g ? 'border-brand bg-brand-soft font-semibold' : 'border-line hover:border-brand/40'
                          }`}
                        >
                          <input type="radio" name="gateway" checked={gateway === g} onChange={() => setGateway(g)} className="accent-brand" />
                          {GATEWAY_LABEL[g]}
                        </label>
                      ))}
                    {!gateways.stripe && !gateways.paypal && !gateways.razorpay && (
                      <p className="text-sm text-muted">No payment gateway is configured on this install yet.</p>
                    )}
                  </div>
                </div>
              )}

              {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
              <button
                onClick={checkout}
                disabled={busy || (cart.subtotal > 0 && !(gateways?.stripe || gateways?.paypal || gateways?.razorpay))}
                className="btn-primary mt-5 w-full py-3"
              >
                {busy ? 'Processing…' : cart.subtotal === 0 ? 'Enroll for free' : 'Checkout'}
              </button>
              <p className="mt-3 text-center text-xs text-muted">Payments are processed securely — card details never touch our servers</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
