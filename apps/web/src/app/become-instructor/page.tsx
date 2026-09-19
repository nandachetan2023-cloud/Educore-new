'use client';

import Link from 'next/link';
import { useBranding, useAuth } from '@/lib/providers';

export default function BecomeInstructorPage() {
  const branding = useBranding();
  const { user } = useAuth();

  const perks = [
    ['Teach your way', 'Create video courses with chapters, lessons, and downloadable resources.'],
    ['Earn revenue', 'Get paid for every enrollment, with transparent payouts to your wallet.'],
    ['Reach learners', 'Publish to a global catalog and grow your student base.'],
  ];

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-3xl text-center">
        <span className="badge">Instructors</span>
        <h1 className="mt-4 text-4xl font-extrabold">Teach on {branding?.name}</h1>
        <p className="mt-4 text-lg text-muted">
          Turn your expertise into income. Join our instructors and share what you know with learners around the world.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          {user?.principal === 'instructor' ? (
            <Link href="/dashboard/instructor" className="btn-primary px-7 py-3">Go to instructor dashboard</Link>
          ) : (
            <Link href="/register" className="btn-primary px-7 py-3">Become an instructor</Link>
          )}
        </div>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        {perks.map(([title, body]) => (
          <div key={title} className="card p-6">
            <h3 className="font-bold">{title}</h3>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
