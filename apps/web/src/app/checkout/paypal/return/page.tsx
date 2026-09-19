'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

function PaypalReturnInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const orderId = params.get('order');
    const paypalOrderId = params.get('token'); // PayPal returns the order id as `token`
    if (!orderId || !paypalOrderId) {
      setErr('Missing payment details from PayPal.');
      return;
    }
    api(`/checkout/paypal/${orderId}/capture`, {
      method: 'POST',
      body: JSON.stringify({ paypalOrderId }),
    })
      .then(() => router.replace(`/checkout/success?order=${orderId}`))
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Could not confirm your PayPal payment'));
  }, [params, router]);

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="card max-w-md p-10 text-center">
        {err ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/15 text-3xl">✕</div>
            <h1 className="mt-5 text-2xl font-extrabold">Payment not confirmed</h1>
            <p className="mt-2 text-muted">{err}</p>
          </>
        ) : (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
            <h1 className="mt-5 text-xl font-bold">Confirming your PayPal payment…</h1>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaypalReturnPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center">Loading…</div>}>
      <PaypalReturnInner />
    </Suspense>
  );
}
