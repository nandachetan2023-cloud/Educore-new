'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight, Award, BookOpen, DollarSign, LayoutDashboard, Plus, Search, Star, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { LineChart } from '@/components/charts';
import { DirectoryShell } from '@/components/directory-shell';

interface InstructorStats { totalCourses: number; publishedCourses: number; totalStudents: number; walletBalance: number }
interface MyCourse {
  id: number; title: string; slug: string; status: string; isApproved: string;
  price?: number; _count: { enrollments: number; chapters: number };
}
interface InstructorAnalytics {
  enrollmentsByDay: { date: string; count: number }[];
  topCourses: { title: string; enrollments: number }[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function StatCard({ icon: Icon, tint, label, value }: { icon: any; tint: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
      </div>
      <div className="mt-3 text-[13px] text-muted">{label}</div>
      <div className="font-display text-[32px] font-semibold leading-tight text-ink">{value}</div>
    </div>
  );
}

export default function InstructorDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [stats, setStats] = useState<InstructorStats | null>(null);
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [analytics, setAnalytics] = useState<InstructorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const currency = branding?.currency ?? 'USD';
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

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

  // Real weekday aggregation from the 30-day enrollment series.
  const weekdayBars = useMemo(() => {
    const sums = [0, 0, 0, 0, 0, 0, 0];
    (analytics?.enrollmentsByDay ?? []).forEach((d) => {
      const day = new Date(d.date).getDay();
      if (!Number.isNaN(day)) sums[day] += d.count;
    });
    const order = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
    return order.map((d) => ({ label: WEEKDAYS[d], value: sums[d] }));
  }, [analytics]);
  const maxBar = Math.max(1, ...weekdayBars.map((b) => b.value));

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const filtered = courses.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));

  const statusBadge = (c: MyCourse) => {
    if (c.isApproved === 'pending') return <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600">Review</span>;
    if (c.isApproved === 'rejected') return <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-500">Rejected</span>;
    if (c.status === 'active') return <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-600">Published</span>;
    return <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs font-bold text-slate-500">Draft</span>;
  };

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const catalogPct = stats?.totalCourses ? Math.round(((stats.publishedCourses ?? 0) / stats.totalCourses) * 100) : 0;

  return (
    <DirectoryShell
      eyebrow="Instructor Studio"
      sections={[
        {
          heading: 'Teach',
          links: [
            { href: '/dashboard/instructor', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/dashboard/instructor/courses/new', label: 'New Course', icon: Plus },
            { href: '/dashboard/instructor/payouts', label: 'Payouts', icon: Wallet },
            { href: '/courses', label: 'Browse Catalog', icon: BookOpen },
          ],
        },
      ]}
      userName={user?.name ?? 'Instructor'}
      userCaption="Instructor"
      userImage={user?.image}
      onLogout={logout}
      searchPlaceholder="Search my courses…"
      searchValue={query}
      onSearch={setQuery}
    >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-xl font-bold text-brand">
                {user?.name?.[0] ?? 'J'}
              </span>
              <div>
                <h1 className="font-display text-[32px] font-semibold tracking-tight text-ink">
                  Welcome back, {user?.name?.split(' ')[0]}
                </h1>
                <p className="text-sm text-muted">📅 Today is {today}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/instructor/payouts" className="btn-ghost rounded-full text-sm">
                <ArrowUpRight className="h-4 w-4" /> View Payouts
              </Link>
              <Link href="/dashboard/instructor/courses/new" className="btn-primary rounded-full text-sm">
                <Plus className="h-4 w-4" /> Create New Course
              </Link>
            </div>
          </div>

          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={DollarSign} tint="bg-blue-500/10 text-brand" label="Wallet Balance" value={money(stats?.walletBalance ?? 0)} />
            <StatCard icon={Users} tint="bg-blue-500/10 text-brand" label="Active Enrollments" value={(stats?.totalStudents ?? 0).toLocaleString()} />
            <StatCard icon={Star} tint="bg-blue-500/10 text-brand" label="Published Courses" value={String(stats?.publishedCourses ?? 0)} />
            <StatCard icon={TrendingUp} tint="bg-blue-500/10 text-brand" label="Total Courses" value={String(stats?.totalCourses ?? 0)} />
          </div>

          {/* Charts */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
            <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-ink">Earnings Overview</h2>
                  <p className="text-[13px] text-muted">Monthly enrollment growth performance</p>
                </div>
                <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">30 Days</span>
              </div>
              <div className="mt-4">
                {analytics?.enrollmentsByDay?.length ? (
                  <LineChart data={analytics.enrollmentsByDay.map((d) => ({ label: d.date, value: d.count }))} height={220} />
                ) : (
                  <p className="py-10 text-center text-sm text-muted">No enrollment data yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ink">Weekly Engagement</h2>
              <p className="text-[13px] text-muted">Enrollments by weekday</p>
              <div className="mt-5 flex h-48 items-end justify-between gap-2">
                {weekdayBars.map((b) => (
                  <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <div className="flex w-full max-w-[26px] flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-green-500"
                        style={{ height: `${Math.max(4, (b.value / maxBar) * 100)}%`, opacity: 0.55 + 0.45 * (b.value / maxBar) }}
                        title={`${b.value} enrollments`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-muted">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active courses */}
          <div id="courses" className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Active Courses</h2>
              <p className="text-[13px] text-muted">Manage your published and draft curriculum</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search courses..."
                  className="w-52 rounded-full border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-line bg-card p-12 text-center shadow-sm">
              <p className="text-muted">You haven&apos;t created any courses yet.</p>
              <Link href="/dashboard/instructor/courses/new" className="btn-primary mt-4 rounded-full">Create your first course</Link>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[13px] text-muted">
                    <th className="px-5 py-3.5 font-medium">Course Details</th>
                    <th className="px-5 py-3.5 font-medium">Enrollments</th>
                    <th className="px-5 py-3.5 font-medium">Price</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((c) => (
                    <tr key={c.id} className="transition hover:bg-surface">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg">
                            <img src={`https://picsum.photos/seed/educore-${c.id}/320/180`} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </span>
                          <span>
                            <span className="block font-bold text-ink">{c.title}</span>
                            <span className="block text-xs text-muted">◷ {c._count.chapters} sections</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-ink">{c._count.enrollments.toLocaleString()}</td>
                      <td className="px-5 py-4 font-bold text-green-600">{money(c.price ?? 0)}</td>
                      <td className="px-5 py-4">{statusBadge(c)}</td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/dashboard/instructor/courses/${c.id}`} className="rounded-full border border-line px-4 py-1.5 text-[13px] font-semibold text-ink transition hover:border-brand hover:text-brand">
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payout + milestones */}
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl bg-brand p-7 text-white shadow-lift">
              <span className="pointer-events-none absolute -right-6 -top-10 select-none font-display text-[160px] font-semibold leading-none text-white/10">$</span>
              <p className="text-white/70">Pending Payout</p>
              <p className="mt-1 font-display text-5xl font-semibold">{money(stats?.walletBalance ?? 0)}</p>
              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="text-white/70">Available balance</span>
                <span className="font-semibold">Wallet</span>
              </div>
              <Link href="/dashboard/instructor/payouts" className="mt-5 block rounded-full bg-card py-3 text-center text-sm font-bold text-brand transition hover:brightness-95">
                Request Withdrawal
              </Link>
            </div>

            <div className="rounded-2xl border border-line bg-card p-7 shadow-sm">
              <h2 className="text-lg font-bold text-ink">Teacher Milestones</h2>
              <p className="text-[13px] text-muted">Your path to Platinum Instructor</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold text-ink">Catalog Published</span>
                <span className="text-muted">{stats?.publishedCourses ?? 0} / {stats?.totalCourses ?? 0}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-green-500" style={{ width: `${catalogPct}%` }} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className={`rounded-xl border p-4 ${stats?.publishedCourses ? 'border-green-500/30 bg-green-500/[0.06]' : 'border-line opacity-60'}`}>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><Award className="h-4 w-4 text-green-600" /> Published Author</p>
                  <p className="mt-1 text-xs text-muted">{stats?.publishedCourses ? 'Achieved — courses live on the marketplace.' : 'Publish a course to unlock.'}</p>
                </div>
                <div className={`rounded-xl border p-4 ${stats?.totalStudents ? 'border-green-500/30 bg-green-500/[0.06]' : 'border-line opacity-60'}`}>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><Users className="h-4 w-4 text-green-600" /> First Students</p>
                  <p className="mt-1 text-xs text-muted">{stats?.totalStudents ? `${stats.totalStudents.toLocaleString()} learners enrolled.` : 'Enroll your first student to unlock.'}</p>
                </div>
              </div>
            </div>
          </div>
    </DirectoryShell>
  );
}
