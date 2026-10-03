'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Landmark, Lock, ShieldCheck, Star, Tag, Wallet, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { Stars } from '@/components/ui';
import type { AppliedPromo, CouponPreview } from '@/lib/types';

interface CartItem {
  id: number;
  course: {
    id: number;
    title: string;
    slug: string;
    thumbnail?: string;
    price?: number;
    discount?: number;
    offerDiscount?: number;
    payable?: number;
    instructor: { name: string };
    averageRating?: number | null;
  };
}
interface CartResponse {
  items: CartItem[];
  subtotal: number;
  total: number;
  offer: AppliedPromo | null;
  count: number;
}
interface Gateways { stripe: boolean; paypal: boolean; razorpay: boolean; razorpayKeyId?: string }
type GatewayId = 'stripe' | 'paypal' | 'razorpay';

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
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<CouponPreview | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

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

  const applyCode = async () => {
    if (!code.trim()) return;
    setCodeBusy(true);
    setCodeError(null);
    try {
      const preview = await api<CouponPreview>('/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      setApplied(preview);
      setCode('');
    } catch (e) {
      setApplied(null);
      setCodeError(e instanceof ApiError ? e.message : 'That code could not be applied');
    } finally {
      setCodeBusy(false);
    }
  };

  const clearCode = () => {
    setApplied(null);
    setCodeError(null);
    setCode('');
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
      }>('/checkout', {
        method: 'POST',
        body: JSON.stringify({ gateway, ...(applied?.code ? { couponCode: applied.code } : {}) }),
      });

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

  const original = cart?.items.reduce((n, i) => n + (i.course.price ?? 0), 0) ?? 0;
  const courseDiscount = original - (cart?.subtotal ?? 0);
  // The server prices the cart, so trust its number over anything derived here.
  const promoDiscount = Math.max(0, (cart?.subtotal ?? 0) - (cart?.total ?? 0));
  const payable = cart?.total ?? cart?.subtotal ?? 0;
  const appliedCoupon = applied?.code ? applied : null;
  const offerRow = cart?.offer?.kind === 'offer' ? cart.offer : null;
  // Whichever promotion the server honored is the one that produced the saving.
  const offerAmount = offerRow && (!appliedCoupon || applied?.kind === 'offer') ? promoDiscount : 0;
  const couponAmount = appliedCoupon?.discount ?? 0;
  const backHref = cart?.items[0] ? `/courses/${cart.items[0].course.slug}` : '/courses';

  return (
    <div className="bg-surface">
      <div className="container-page py-8">
        {/* Header + steps */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted hover:text-brand">
              <ArrowLeft className="h-4 w-4" /> Back to Course
            </Link>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">Checkout</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-2 font-bold text-ink">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">1</span>
              Payment
            </span>
            <span className="h-px w-10 bg-line" />
            <span className="flex items-center gap-2 font-medium text-muted">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-card text-sm font-bold">2</span>
              Success
            </span>
          </div>
        </div>

        {!cart || cart.items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-line bg-card p-16 text-center shadow-sm">
            <p className="text-muted">Your cart is empty.</p>
            <Link href="/courses" className="btn-primary mt-5 rounded-full">Browse courses</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            {/* ── Left: payment method ── */}
            <div>
              <h2 className="text-lg font-bold text-ink">Choose Payment Method</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {gateways?.stripe !== false && (
                  <button
                    onClick={() => setGateway('stripe')}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                      gateway === 'stripe' ? 'border-brand bg-brand-soft/40' : 'border-line bg-card hover:border-brand/40'
                    }`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-brand">
                      <CreditCard className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-ink">Credit / Debit Card</span>
                      <span className="block text-xs text-muted">Visa, Mastercard, Amex</span>
                    </span>
                    <span className="ml-auto flex gap-1">
                      <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-bold text-muted">VISA</span>
                      <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-bold text-muted">MC</span>
                    </span>
                  </button>
                )}
                {gateways?.paypal !== false && (
                  <button
                    onClick={() => setGateway('paypal')}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                      gateway === 'paypal' ? 'border-brand bg-brand-soft/40' : 'border-line bg-card hover:border-brand/40'
                    }`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-brand">
                      <Wallet className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-ink">PayPal</span>
                      <span className="block text-xs text-muted">Faster & Secure</span>
                    </span>
                    <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10px] font-bold text-muted">PayPal</span>
                  </button>
                )}
                {gateways?.razorpay && (
                  <button
                    onClick={() => setGateway('razorpay')}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                      gateway === 'razorpay' ? 'border-brand bg-brand-soft/40' : 'border-line bg-card hover:border-brand/40'
                    }`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-brand">
                      <Landmark className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-ink">Razorpay / UPI</span>
                      <span className="block text-xs text-muted">Cards, UPI & netbanking</span>
                    </span>
                  </button>
                )}
              </div>
              {gateways && !gateways.stripe && !gateways.paypal && !gateways.razorpay && (
                <p className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                  No payment gateway is configured on this install yet — free enrollment still works.
                </p>
              )}

              {/* Cart items */}
              <h2 className="mt-8 text-lg font-bold text-ink">Your Courses ({cart.count})</h2>
              <div className="mt-4 space-y-3">
                {cart.items.map((item) => {
                  const net = Math.max(0, (item.course.price ?? 0) - (item.course.discount ?? 0));
                  const itemPayable = item.course.payable ?? net;
                  return (
                    <div key={item.id} className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm">
                      <span className="h-16 w-24 shrink-0 overflow-hidden rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.course.thumbnail || `https://picsum.photos/seed/educore-${item.course.id}/320/180`}
                          alt="" loading="lazy" className="h-full w-full object-cover"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/courses/${item.course.slug}`} className="truncate font-bold text-ink hover:text-brand">
                          {item.course.title}
                        </Link>
                        <p className="text-sm text-muted">Instructor: {item.course.instructor.name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {itemPayable < net && (
                          <div className="text-[13px] font-medium text-muted line-through">{fmt(net)}</div>
                        )}
                        <div className="font-extrabold text-ink">{itemPayable === 0 ? 'Free' : fmt(itemPayable)}</div>
                        <button onClick={() => remove(item.id)} className="mt-1 text-[13px] font-medium text-red-500 hover:underline">Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {error && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>}
              <button
                onClick={checkout}
                disabled={busy || (payable > 0 && !(gateways?.stripe || gateways?.paypal || gateways?.razorpay))}
                className="btn-primary mt-6 w-full rounded-xl py-4 text-base"
              >
                {busy ? 'Processing…' : payable === 0 ? 'Enroll for free' : `Complete Purchase • ${fmt(payable)}`}
              </button>
              <p className="mt-3 text-center text-[13px] text-muted">
                ⓘ By completing this purchase, you agree to the Terms of Service.
              </p>
            </div>

            {/* ── Right: order summary ── */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-lift">
                <h2 className="border-b border-line px-6 py-4 text-lg font-bold text-ink">Order Summary</h2>
                <div className="space-y-4 px-6 py-5">
                  {cart.items.slice(0, 3).map((item) => (                    <div key={item.id} className="flex items-center gap-3">
                      <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.course.thumbnail || `https://picsum.photos/seed/educore-${item.course.id}/320/180`}
                          alt="" loading="lazy" className="h-full w-full object-cover"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{item.course.title}</p>
                        <p className="truncate text-xs text-muted">Instructor: {item.course.instructor.name}</p>
                        <p className="mt-1 flex items-center gap-2">
                          <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Bestseller</span>
                          <span className="flex items-center gap-0.5 text-xs font-bold text-green-600">
                            <Star className="h-3 w-3 fill-current" /> {(item.course.averageRating ?? 4.8).toFixed(1)}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* ── Coupon / promotion ── */}
                  <div className="border-t border-line pt-4">
                    {appliedCoupon ? (
                      <div className="flex items-center gap-2 rounded-xl bg-green-500/10 px-3 py-2.5">
                        <Tag size={15} className="shrink-0 text-green-600" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-green-700">{appliedCoupon.code} applied</p>
                          <p className="text-xs text-green-700/80">
                            {appliedCoupon.label} — you save {fmt(couponAmount)}
                          </p>
                        </div>
                        <button onClick={clearCode} title="Remove coupon" className="rounded-lg p-1 text-green-700 hover:bg-green-500/10">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="label">Have a coupon code?</label>
                        <div className="flex gap-2">
                          <input
                            className="input uppercase"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') applyCode();
                            }}
                            placeholder="WELCOME10"
                            aria-label="Coupon code"
                          />
                          <button onClick={applyCode} disabled={codeBusy || !code.trim()} className="btn-ghost shrink-0">
                            {codeBusy ? '…' : 'Apply'}
                          </button>
                        </div>
                        {codeError && <p className="mt-2 text-xs font-medium text-red-500">{codeError}</p>}
                      </>
                    )}

                    {offerRow && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                        <Tag size={12} className="text-brand" />
                        {offerRow.title} is running — {offerRow.valueLabel} applied automatically.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2 border-t border-line px-6 py-5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Original Price</span>
                    <span className="font-semibold text-muted line-through">{fmt(original)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Marketplace Discount</span>
                    <span className="font-semibold text-green-600">-{fmt(courseDiscount)}</span>
                  </div>
                  {offerRow && (
                    <div className="flex justify-between">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted">
                        <Tag size={13} className="shrink-0 text-brand" />
                        <span className="truncate">{offerRow.title}</span>
                      </span>
                      {offerAmount > 0 && <span className="font-semibold text-green-600">-{fmt(offerAmount)}</span>}
                    </div>
                  )}
                  {appliedCoupon && (
                    <div className="flex justify-between">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted">
                        <Tag size={13} className="shrink-0 text-brand" />
                        <span className="truncate">Coupon {appliedCoupon.code}</span>
                      </span>
                      <span className="font-semibold text-green-600">-{fmt(couponAmount)}</span>
                    </div>
                  )}
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>You save</span>
                      <span className="font-bold">{fmt(promoDiscount)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-line pt-3">
                    <span className="text-base font-bold text-ink">Total</span>
                    <span className="text-right">
                      <span className="block text-2xl font-extrabold text-brand">{payable === 0 ? 'Free' : fmt(payable)}</span>
                      <span className="block text-[11px] font-normal text-muted">Inclusive of all taxes</span>
                    </span>
                  </div>
                </div>
                <div className="bg-brand-soft/50 px-6 py-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand">Course includes:</h3>
                  <ul className="mt-2.5 space-y-1.5 text-[13px] text-ink/75">
                    <li>▶ On-demand video lessons</li>
                    <li>◷ Full lifetime access</li>
                    <li>◉ Certificate of completion</li>
                    <li>ⓘ Access on mobile and TV</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-line bg-card px-4 py-4 text-center shadow-sm">
                  <ShieldCheck className="mx-auto h-5 w-5 text-green-600" />
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-ink">30-Day Guarantee</p>
                </div>
                <div className="rounded-2xl border border-line bg-card px-4 py-4 text-center shadow-sm">
                  <Lock className="mx-auto h-5 w-5 text-brand" />
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-ink">Secure Checkout</p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
