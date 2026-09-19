'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { StatTile } from '@/components/stat-tile';
import { LineChart, BarList } from '@/components/charts';

interface InstructorStats { totalCourses: number; publishedCourses: number; totalStudents: number; walletBalance: number }
interface MyCourse {
  id: number; title: string; slug: string; status: string; isApproved: string;
  price?: number; _count: { enrollments: number; chapters: number };
}
interface InstructorAnalytics {
  enrollmentsByDay: { date: string; count: number }[];
  topCourses: { title: string; enrollments: number }[];
}

export default function InstructorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [stats, setStats] = useState<InstructorStats | null>(null);
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [analytics, setAnalytics] = useState<InstructorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const currency = branding?.currency ?? 'USD';

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard/instructor'); return; }
    if (user.principal !== 'instructor') { router.push('/dashboard'); return; }
    Promise.all([
      api<InstructorStats>('/dashboard/instructor').catch(() => null),
      api<MyCourse[]>('/courses/mine').catch(() => []),
      api<InstructorAnalytics>('/dashboard/instructor/analytics').catch(() => null),
    ]).then(([s, c, a]) => {
      setStats(s);
      setCourses(c ?? []);
      setAnalytics(a);
      setLoading(false);
    });
  }, [user, authLoading]);

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const statusBadge = (c: MyCourse) => {
    if (c.isApproved === 'pending') return <span className="badge bg-amber-500/15 text-amber-600">Pending review</span>;
    if (c.isApproved === 'rejected') return <span className="badge bg-red-500/15 text-red-600">Rejected</span>;
    if (c.status === 'active') return <span className="badge bg-green-500/15 text-green-600">Published</span>;
    return <span className="badge">Draft</span>;
  };

  return (
    <div className="container-page py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Instructor dashboard</h1>
          <p className="mt-1 text-muted">Manage your courses and earnings.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/instructor/payouts" className="btn-ghost">Payouts</Link>
          <Link href="/dashboard/instructor/courses/new" className="btn-primary">+ New course</Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total courses" value={stats?.totalCourses ?? 0} />
        <StatTile label="Published" value={stats?.publishedCourses ?? 0} />
        <StatTile label="Total students" value={stats?.totalStudents ?? 0} />
        <StatTile
          label="Wallet balance"
          value={new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(stats?.walletBalance ?? 0)}
        />
      </div>

      {analytics && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold">Enrollments — last 30 days</h3>
            <div className="mt-4">
              <LineChart data={analytics.enrollmentsByDay.map((d) => ({ label: d.date, value: d.count }))} />
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Top courses</h3>
            <div className="mt-4">
              <BarList data={analytics.topCourses.map((c) => ({ label: c.title, value: c.enrollments }))} />
            </div>
          </div>
        </div>
      )}

      <h2 className="mt-12 text-xl font-bold">Your courses</h2>
      {courses.length === 0 ? (
        <div className="card mt-4 p-12 text-center">
          <p className="text-muted">You haven&apos;t created any courses yet.</p>
          <Link href="/dashboard/instructor/courses/new" className="btn-primary mt-4">Create your first course</Link>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden">
          <div className="card divide-y divide-line">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.title}</span>
                    {statusBadge(c)}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {c._count.chapters} sections · {c._count.enrollments} students
                  </div>
                </div>
                <Link href={`/dashboard/instructor/courses/${c.id}`} className="btn-ghost">Manage</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
