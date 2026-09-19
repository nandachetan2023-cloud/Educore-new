'use client';

import { Suspense } from 'react';
import Link from 'next/link';

function SuccessInner() {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="card max-w-md p-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/15 text-3xl">✓</div>
        <h1 className="mt-5 text-2xl font-extrabold">Payment successful!</h1>
        <p className="mt-2 text-muted">
          You&apos;re enrolled. Your courses are ready in your learning dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">Go to my courses</Link>
          <Link href="/courses" className="btn-ghost">Keep browsing</Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center">Loading…</div>}>
      <SuccessInner />
    </Suspense>
  );
}
