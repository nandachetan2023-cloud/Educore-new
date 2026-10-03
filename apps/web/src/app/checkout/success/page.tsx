'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

function SuccessInner() {
  return (
    <div className="bg-surface">
      <div className="container-page py-10">
        <div className="flex items-center justify-center gap-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-muted">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-green-500 text-sm font-bold text-white"><Check className="h-4 w-4" /></span>
            Payment
          </span>
          <span className="h-px w-10 bg-line" />
          <span className="flex items-center gap-2 font-bold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">2</span>
            Success
          </span>
        </div>

        <div className="mx-auto mt-8 max-w-md rounded-[24px] border border-line bg-card p-10 text-center shadow-lift">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/15 text-green-600">
            <Check className="h-8 w-8" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold text-ink">Payment successful!</h1>
          <p className="mt-2 text-muted">
            You&apos;re enrolled. Your courses are ready in your learning dashboard.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/dashboard" className="btn-primary rounded-full">Go to my courses</Link>
            <Link href="/courses" className="btn-ghost rounded-full">Keep browsing</Link>
          </div>
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
