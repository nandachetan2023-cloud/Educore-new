'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BadgeDollarSign, BookOpen, ChevronRight, CreditCard, FileText, LayoutDashboard,
  ShoppingCart, Star, UserCog, Users, Wallet, Palette,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { LineChart, BarList } from '@/components/charts';

interface Analytics {
  enrollmentsByDay: { date: string; count: number }[];
  revenueByDay: { date: string; amount: number }[];
  topCourses: { title: string; enrollments: number }[];
}

type Tab = 'overview' | 'courses' | 'instructors' | 'reviews' | 'withdraws';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { key: 'courses', label: 'Courses', icon: <BookOpen size={18} /> },
  { key: 'instructors', label: 'Instructors', icon: <UserCog size={18} /> },
  { key: 'reviews', label: 'Reviews', icon: <Star size={18} /> },
  { key: 'withdraws', label: 'Withdraws', icon: <Wallet size={18} /> },
];

export default function AdminConsole() {
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
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
    api('/dashboard/admin').then(setStats).catch(() => {});
    api<Analytics>('/dashboard/admin/analytics').then(setAnalytics).catch(() => {});
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
    api('/dashboard/admin').then(setStats).catch(() => {});
  };

  if (authLoading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="min-h-[calc(100vh-68px)] bg-[#f7f9fb] text-slate-900">
      <div>
        <aside className="hidden bg-slate-950 px-3 py-7 text-slate-300 lg:fixed lg:inset-y-[68px] lg:left-0 lg:block lg:w-[220px] lg:overflow-y-auto">
          <div className="px-3 pb-8">
            <p className="truncate text-lg font-black text-white">{branding?.name || 'Admin console'}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Tenant admin</p>
          </div>
          <nav className="space-y-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${
                  tab === t.key ? 'bg-blue-600 text-white' : 'hover:bg-white/10 hover:text-white'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
          <div className="mt-8 space-y-1 border-t border-white/10 pt-5">
            <SideLink href="/dashboard/admin/white-label" icon={<Palette size={18} />} label="White label" />
            <SideLink href="/dashboard/admin/billing" icon={<CreditCard size={18} />} label="Billing" />
            <SideLink href="/dashboard/admin/content" icon={<FileText size={18} />} label="Site content" />
          </div>
          <div className="mt-12 border-t border-white/10 px-3 pt-5 text-xs text-slate-500">
            Signed in as<br /><span className="font-medium text-slate-200">{user?.name ?? 'Admin user'}</span>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:ml-[220px] lg:px-10">
          <div className="mx-auto max-w-[1220px]">
          {/* Mobile nav (sidebar is desktop-only) */}
          <div className="mb-6 flex flex-wrap gap-2 lg:hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`btn px-3 py-2 text-sm ${tab === t.key ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white'}`}
              >
                {t.label}
              </button>
            ))}
            <Link href="/dashboard/admin/white-label" className="btn-ghost px-3 py-2 text-sm">White label</Link>
            <Link href="/dashboard/admin/billing" className="btn-ghost px-3 py-2 text-sm">Billing</Link>
          </div>

          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-700">Tenant operations</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Admin console</h1>
            </div>
            <Link href="/dashboard/admin/content" className="btn-primary inline-flex items-center gap-2">
              Site content <ChevronRight size={17} />
            </Link>
          </header>

          {tab === 'overview' && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Kpi icon={<Users size={19} />} label="Students" value={String(stats?.students ?? 0)} tone="blue" />
                <Kpi icon={<UserCog size={19} />} label="Instructors" value={String(stats?.instructors ?? 0)} tone="violet" />
                <Kpi icon={<BookOpen size={19} />} label="Courses" value={String(stats?.courses ?? 0)} tone="slate" />
                <Kpi icon={<ShoppingCart size={19} />} label="Orders" value={String(stats?.orders ?? 0)} tone="slate" />
                <Kpi icon={<BadgeDollarSign size={19} />} label="Revenue" value={money(stats?.revenue ?? 0)} tone="green" />
              </section>

              {analytics && (
                <section className="mt-6 grid gap-6 xl:grid-cols-3">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-6 xl:col-span-2">
                    <h2 className="font-bold">Enrollments — last 30 days</h2>
                    <div className="mt-4 text-blue-600">
                      <LineChart data={analytics.enrollmentsByDay.map((d) => ({ label: d.date, value: d.count }))} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="font-bold">Top courses</h2>
                    <div className="mt-4">
                      <BarList data={analytics.topCourses.map((c) => ({ label: c.title, value: c.enrollments }))} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-3">
                    <h2 className="font-bold">Revenue — last 30 days</h2>
                    <div className="mt-4 text-blue-600">
                      <LineChart
                        data={analytics.revenueByDay.map((d) => ({ label: d.date, value: d.amount }))}
                        color="rgb(37 99 235)"
                        formatValue={money}
                      />
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {tab !== 'overview' && (
            <section>
              {loading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">Loading…</div>
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
                            <div className="text-sm text-slate-500">by {c.instructor?.name} · {c._count?.chapters} sections</div>
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
                            <div className="text-sm text-slate-500">{i.email} · {i._count?.courses} courses</div>
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
                            <div className="text-sm text-slate-500">{r.user?.name} on {r.course?.title}</div>
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
                            <div className="text-sm text-slate-500">{w.instructor?.name} · balance {money(w.instructor?.wallet ?? 0)}</div>
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
    <Link href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white">
      {icon}
      {label}
    </Link>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'blue' | 'slate' | 'violet' | 'green' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', slate: 'bg-slate-100 text-slate-700', violet: 'bg-violet-50 text-violet-700', green: 'bg-green-50 text-green-700' };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <span className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-5 text-3xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function ModTable({ rows, render, empty }: { rows: any[]; render: (r: any) => React.ReactNode; empty: string }) {
  if (rows.length === 0) return <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">{empty}</div>;
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
      <button onClick={onReject} className="btn border border-slate-200 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">Reject</button>
    </div>
  );
}
