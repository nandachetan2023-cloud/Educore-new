'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BadgeDollarSign, BookOpen, ChevronRight, CreditCard, FileText, LayoutDashboard,
  ShoppingCart, Star, TrendingDown, TrendingUp, UserCog, Users, Wallet, Palette,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { LineChart } from '@/components/charts';

interface Stats {
  students: number;
  instructors: number;
  courses: number;
  orders: number;
  revenue: number;
  trends: { students: number; instructors: number; courses: number; orders: number; revenue: number };
}

interface Analytics {
  enrollmentsByDay: { date: string; count: number }[];
  revenueByDay: { date: string; amount: number }[];
  topCourses: { title: string; enrollments: number }[];
}

interface ActivityRow {
  id: number;
  studentName: string;
  courseTitle: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved';
  createdAt: string;
}

type Tab = 'overview' | 'courses' | 'instructors' | 'reviews' | 'withdraws';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { key: 'courses', label: 'Courses', icon: <BookOpen size={17} /> },
  { key: 'instructors', label: 'Instructors', icon: <UserCog size={17} /> },
  { key: 'reviews', label: 'Reviews', icon: <Star size={17} /> },
  { key: 'withdraws', label: 'Withdraws', icon: <Wallet size={17} /> },
];

// Purely decorative rotation for list avatars — not brand-themed on purpose,
// so individual rows stay visually distinct from each other and from the
// single tenant accent color used for interactive/brand elements.
const AVATAR_TONES = [
  { bg: '#EFEDFA', fg: '#5B4FE0' },
  { bg: '#FDF0E4', fg: '#B45309' },
  { bg: '#E9F5EF', fg: '#1C8A5B' },
  { bg: '#FCE9EF', fg: '#BE185D' },
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminConsole() {
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const currency = branding?.currency ?? 'USD';
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard/admin'); return; }
    if (user.principal !== 'admin') { router.push('/dashboard'); return; }
    // Superadmin has no tenant to moderate here — send them to the platform console.
    if (user.adminRole === 'super_admin') { router.push('/dashboard/superadmin'); return; }
    api<Stats>('/dashboard/admin').then(setStats).catch(() => {});
    api<Analytics>('/dashboard/admin/analytics').then(setAnalytics).catch(() => {});
    api<ActivityRow[]>('/dashboard/admin/activity').then(setActivity).catch(() => setActivity([]));
  }, [user, authLoading]);

  const endpoints: Record<Exclude<Tab, 'overview'>, string> = {
    courses: '/admin/courses?status=pending',
    instructors: '/admin/instructors?status=pending',
    reviews: '/admin/reviews',
    withdraws: '/admin/withdraws',
  };

  const loadTab = useCallback((t: Tab) => {
    if (t === 'overview') return;
    setLoading(true);
    api<any[]>(endpoints[t]).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTab(tab); }, [tab]);

  const act = async (path: string) => {
    await api(path, { method: 'POST' });
    loadTab(tab);
    api<Stats>('/dashboard/admin').then(setStats).catch(() => {});
  };

  if (authLoading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const maxCourseEnrollments = Math.max(1, ...(analytics?.topCourses.map((c) => c.enrollments) ?? [1]));

  return (
    <div style={{ fontFamily: 'var(--font-admin-body)' }} className="min-h-[calc(100vh-68px)] bg-[#F6F4EF] text-[#16161A]">
      <div className="lg:grid lg:grid-cols-[220px_1fr]">

        {/* Sidebar */}
        <aside className="hidden bg-[#101114] px-3 py-6 text-[#B7B9C2] lg:sticky lg:top-[68px] lg:block lg:h-[calc(100vh-68px)] lg:overflow-y-auto">
          <div className="flex items-center gap-2.5 border-b border-white/[0.09] px-2 pb-5 mb-4">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand text-[13px] font-bold text-white" style={{ fontFamily: 'var(--font-admin-display)' }}>
              {(branding?.name || 'E')[0]}
            </div>
            <p className="truncate text-[15px] font-semibold text-white" style={{ fontFamily: 'var(--font-admin-display)' }}>{branding?.name || 'Admin console'}</p>
          </div>

          <div className="mb-2 px-3 text-[10.5px] font-bold uppercase tracking-[.09em] text-[#5C5F6B]">Workspace</div>
          <nav className="space-y-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium transition"
                style={tab === t.key ? { background: 'rgb(var(--brand-primary) / 0.16)', boxShadow: 'inset 2px 0 0 rgb(var(--brand-primary))', color: '#ffffff' } : undefined}
              >
                <span style={tab === t.key ? { color: 'rgb(var(--brand-primary))' } : { color: '#8A8D98' }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="mb-2 mt-6 px-3 text-[10.5px] font-bold uppercase tracking-[.09em] text-[#5C5F6B]">Platform</div>
          <div className="space-y-0.5">
            <SideLink href="/dashboard/admin/white-label" icon={<Palette size={17} />} label="White label" />
            <SideLink href="/dashboard/admin/billing" icon={<CreditCard size={17} />} label="Billing" />
            <SideLink href="/dashboard/admin/content" icon={<FileText size={17} />} label="Site content" />
          </div>

          <div className="mt-8 flex items-center gap-2.5 border-t border-white/[0.09] px-1 pt-4">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#24262E] text-[12.5px] font-semibold text-[#E7E7EA]">
              {initials(user?.name ?? 'Admin')}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[#E7E7EA]">{user?.name ?? 'Admin user'}</div>
              <div className="text-[11.5px] text-[#7B7E89]">Tenant admin</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 px-4 py-7 sm:px-7 lg:px-10">
          <div className="mx-auto max-w-[1220px]">

            {/* Mobile nav (sidebar is desktop-only) */}
            <div className="mb-6 flex flex-wrap gap-2 lg:hidden">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`btn px-3 py-2 text-sm ${tab === t.key ? 'bg-brand text-white' : 'border border-[#E6E2D8] bg-white'}`}
                >
                  {t.label}
                </button>
              ))}
              <Link href="/dashboard/admin/white-label" className="btn-ghost px-3 py-2 text-sm">White label</Link>
              <Link href="/dashboard/admin/billing" className="btn-ghost px-3 py-2 text-sm">Billing</Link>
            </div>

            <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mb-1.5 text-[12.5px] font-semibold text-brand">TENANT OPERATIONS</p>
                <h1 className="text-[27px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-admin-display)' }}>Admin console</h1>
              </div>
              <Link href="/dashboard/admin/content" className="btn-primary inline-flex items-center gap-2">
                Site content <ChevronRight size={17} />
              </Link>
            </header>

            {tab === 'overview' && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Kpi icon={<Users size={17} />} label="Students" value={String(stats?.students ?? 0)} trend={stats?.trends.students} tone="brand" />
                  <Kpi icon={<UserCog size={17} />} label="Instructors" value={String(stats?.instructors ?? 0)} trend={stats?.trends.instructors} tone="amber" />
                  <Kpi icon={<BookOpen size={17} />} label="Courses" value={String(stats?.courses ?? 0)} trend={stats?.trends.courses} tone="green" />
                  <Kpi icon={<ShoppingCart size={17} />} label="Orders" value={String(stats?.orders ?? 0)} trend={stats?.trends.orders} tone="pink" />
                  <Kpi icon={<BadgeDollarSign size={17} />} label="Revenue" value={money(stats?.revenue ?? 0)} trend={stats?.trends.revenue} tone="dark" />
                </section>

                {analytics && (
                  <section className="mt-5 grid gap-4 xl:grid-cols-3">
                    <div className="overflow-hidden rounded-2xl border border-[#EAE6DB] bg-white p-6 xl:col-span-2">
                      <h2 className="text-[14.5px] font-semibold">Enrollments — last 30 days</h2>
                      <div className="mt-4 text-brand">
                        <LineChart data={analytics.enrollmentsByDay.map((d) => ({ label: d.date, value: d.count }))} color="rgb(var(--brand-primary))" />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#EAE6DB] bg-white p-6">
                      <h2 className="mb-4 text-[14.5px] font-semibold">Top courses</h2>
                      <div className="flex flex-col gap-3.5">
                        {(analytics.topCourses.length === 0) && <p className="text-sm text-[#A6A296]">No enrollments yet.</p>}
                        {analytics.topCourses.map((c, i) => {
                          const tone = AVATAR_TONES[i % AVATAR_TONES.length];
                          const pct = Math.round((c.enrollments / maxCourseEnrollments) * 100);
                          return (
                            <div key={c.title} className="flex items-center gap-2.5">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                                {initials(c.title)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-semibold">{c.title}</div>
                                <div className="mt-1 h-1 rounded-full bg-[#F1EEE4]">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone.fg }} />
                                </div>
                              </div>
                              <div className="shrink-0 text-[12px] font-semibold text-[#837F73]">{c.enrollments}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#EAE6DB] bg-white p-6 xl:col-span-3">
                      <h2 className="text-[14.5px] font-semibold">Revenue — last 30 days</h2>
                      <div className="mt-4 text-brand">
                        <LineChart
                          data={analytics.revenueByDay.map((d) => ({ label: d.date, value: d.amount }))}
                          color="rgb(var(--brand-secondary))"
                          formatValue={money}
                        />
                      </div>
                    </div>
                  </section>
                )}

                {/* Recent activity */}
                <section className="mt-4 overflow-hidden rounded-2xl border border-[#EAE6DB] bg-white">
                  <div className="flex items-center justify-between border-b border-[#F0EDE4] px-6 py-4">
                    <h2 className="text-[14.5px] font-semibold">Recent orders</h2>
                  </div>
                  {activity === null && <div className="p-10 text-center text-sm text-[#A6A296]">Loading…</div>}
                  {activity?.length === 0 && <div className="p-10 text-center text-sm text-[#A6A296]">No orders yet.</div>}
                  {activity?.map((a, i) => {
                    const tone = AVATAR_TONES[i % AVATAR_TONES.length];
                    return (
                      <div key={a.id} className="flex items-center gap-4 border-b border-[#F5F3EC] px-6 py-3 last:border-0">
                        <div className="flex w-[220px] shrink-0 items-center gap-2.5">
                          <div className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                            {initials(a.studentName)}
                          </div>
                          <span className="truncate text-[13px] font-semibold">{a.studentName}</span>
                        </div>
                        <span className="flex-1 truncate text-[13px] text-[#6E6A5F]">{a.courseTitle}</span>
                        <span className="w-[90px] shrink-0 text-[13px] font-semibold">
                          {new Intl.NumberFormat(undefined, { style: 'currency', currency: a.currency, maximumFractionDigits: 0 }).format(a.amount)}
                        </span>
                        <span
                          className="w-[92px] shrink-0 rounded-full px-2.5 py-1 text-center text-[11px] font-semibold"
                          style={a.status === 'approved' ? { background: '#E9F5EF', color: '#1C8A5B' } : { background: '#FBF1DC', color: '#A6841B' }}
                        >
                          {a.status === 'approved' ? 'Paid' : 'Pending'}
                        </span>
                        <span className="w-[80px] shrink-0 text-right text-[12px] text-[#ADA898]">{timeAgo(a.createdAt)}</span>
                      </div>
                    );
                  })}
                </section>
              </>
            )}

            {tab !== 'overview' && (
              <section>
                {loading ? (
                  <div className="rounded-2xl border border-[#EAE6DB] bg-white p-12 text-center text-[#93897B]">Loading…</div>
                ) : (
                  <>
                    {tab === 'courses' && (
                      <ModTable
                        rows={rows}
                        empty="No courses awaiting review."
                        render={(c) => (
                          <>
                            <div className="flex-1">
                              <div className="font-semibold">{c.title}</div>
                              <div className="text-sm text-[#93897B]">by {c.instructor?.name} · {c._count?.chapters} sections</div>
                            </div>
                            <Approve onApprove={() => act(`/admin/courses/${c.id}/approve`)} onReject={() => act(`/admin/courses/${c.id}/reject`)} />
                          </>
                        )}
                      />
                    )}

                    {tab === 'instructors' && (
                      <ModTable
                        rows={rows}
                        empty="No instructors awaiting approval."
                        render={(i) => (
                          <>
                            <div className="flex-1">
                              <div className="font-semibold">{i.name}</div>
                              <div className="text-sm text-[#93897B]">{i.email} · {i._count?.courses} courses</div>
                            </div>
                            <Approve onApprove={() => act(`/admin/instructors/${i.id}/approve`)} onReject={() => act(`/admin/instructors/${i.id}/reject`)} />
                          </>
                        )}
                      />
                    )}

                    {tab === 'reviews' && (
                      <ModTable
                        rows={rows}
                        empty="No reviews awaiting moderation."
                        render={(r) => (
                          <>
                            <div className="flex-1">
                              <div className="text-sm text-amber-500">{'★'.repeat(r.rating)}</div>
                              <div className="font-medium">{r.review}</div>
                              <div className="text-sm text-[#93897B]">{r.user?.name} on {r.course?.title}</div>
                            </div>
                            <Approve onApprove={() => act(`/admin/reviews/${r.id}/approve`)} onReject={() => act(`/admin/reviews/${r.id}/reject`)} />
                          </>
                        )}
                      />
                    )}

                    {tab === 'withdraws' && (
                      <ModTable
                        rows={rows}
                        empty="No withdrawal requests."
                        render={(w) => (
                          <>
                            <div className="flex-1">
                              <div className="font-semibold">{money(w.amount)}</div>
                              <div className="text-sm text-[#93897B]">{w.instructor?.name} · balance {money(w.instructor?.wallet ?? 0)}</div>
                            </div>
                            {w.status === 'pending' ? (
                              <Approve onApprove={() => act(`/admin/withdraws/${w.id}/approve`)} onReject={() => act(`/admin/withdraws/${w.id}/reject`)} />
                            ) : (
                              <span className={`badge ${w.status === 'approved' ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'}`}>{w.status}</span>
                            )}
                          </>
                        )}
                      />
                    )}
                  </>
                )}
              </section>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

function SideLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-[#B7B9C2] transition hover:bg-white/10 hover:text-white">
      <span className="text-[#8A8D98]">{icon}</span>
      {label}
    </Link>
  );
}

const KPI_TONES: Record<string, { badgeBg: string; badgeFg: string }> = {
  brand: { badgeBg: 'rgb(var(--brand-primary) / 0.12)', badgeFg: 'rgb(var(--brand-primary))' },
  amber: { badgeBg: '#FDF0E4', badgeFg: '#B45309' },
  green: { badgeBg: '#E9F5EF', badgeFg: '#1C8A5B' },
  pink: { badgeBg: '#FCE9EF', badgeFg: '#BE185D' },
  dark: { badgeBg: 'rgba(255,255,255,0.1)', badgeFg: '#ffffff' },
};

function Kpi({ icon, label, value, trend, tone }: { icon: React.ReactNode; label: string; value: string; trend?: number; tone: 'brand' | 'amber' | 'green' | 'pink' | 'dark' }) {
  const dark = tone === 'dark';
  const t = KPI_TONES[tone];
  const up = (trend ?? 0) >= 0;
  return (
    <div className="rounded-2xl border p-5" style={dark ? { background: '#16161A', borderColor: '#16161A' } : { background: '#ffffff', borderColor: '#EAE6DB' }}>
      <div className="mb-4 flex items-start justify-between">
        <p className="text-[12.5px] font-semibold" style={{ color: dark ? '#B7B4AB' : '#837F73' }}>{label}</p>
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: t.badgeBg, color: t.badgeFg }}>{icon}</div>
      </div>
      <div className="mb-2 text-[26px] font-semibold" style={{ fontFamily: 'var(--font-admin-display)', color: dark ? '#ffffff' : '#16161A' }}>{value}</div>
      {trend != null && (
        <div className="flex items-center gap-1.5">
          {up ? <TrendingUp size={12} color={dark ? '#7EE0AD' : '#1C8A5B'} /> : <TrendingDown size={12} color="#C4472B" />}
          <span className="text-[12px] font-semibold" style={{ color: up ? (dark ? '#7EE0AD' : '#1C8A5B') : '#C4472B' }}>{Math.abs(trend).toFixed(1)}%</span>
          <span className="text-[12px]" style={{ color: dark ? '#82807C' : '#A6A296' }}>vs last 30 days</span>
        </div>
      )}
    </div>
  );
}

function ModTable({ rows, render, empty }: { rows: any[]; render: (r: any) => React.ReactNode; empty: string }) {
  if (rows.length === 0) return <div className="rounded-2xl border border-[#EAE6DB] bg-white p-12 text-center text-[#93897B]">{empty}</div>;
  return (
    <div className="divide-y divide-[#F0EDE4] overflow-hidden rounded-2xl border border-[#EAE6DB] bg-white">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-4 p-5">{render(r)}</div>
      ))}
    </div>
  );
}

function Approve({ onApprove, onReject }: { onApprove: () => void; onReject: () => void }) {
  return (
    <div className="flex shrink-0 gap-2">
      <button onClick={onApprove} className="btn bg-green-600 px-4 py-2 text-sm text-white hover:brightness-110">Approve</button>
      <button onClick={onReject} className="btn border border-[#E6E2D8] px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">Reject</button>
    </div>
  );
}
