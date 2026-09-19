'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { StatTile } from '@/components/stat-tile';
import { LineChart, BarList } from '@/components/charts';

interface Analytics {
  enrollmentsByDay: { date: string; count: number }[];
  revenueByDay: { date: string; amount: number }[];
  topCourses: { title: string; enrollments: number }[];
}

type Tab = 'overview' | 'courses' | 'instructors' | 'reviews' | 'withdraws';

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
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

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

  const tabs: Tab[] = ['overview', 'courses', 'instructors', 'reviews', 'withdraws'];

  return (
    <div className="container-page py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Admin console</h1>
          <p className="mt-1 text-muted">Moderate the platform and keep things running.</p>
        </div>
        <div className="flex gap-2">
          {user?.adminRole === 'super_admin' && (
            <>
              <Link href="/dashboard/admin/admins" className="btn-ghost">Admins</Link>
              <Link href="/dashboard/admin/branding" className="btn-ghost">Branding</Link>
              <Link href="/dashboard/admin/settings" className="btn-ghost">Settings</Link>
            </>
          )}
          <Link href="/dashboard/admin/content" className="btn-ghost">Site content →</Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition ${
              tab === t ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile label="Students" value={stats?.students ?? 0} />
              <StatTile label="Instructors" value={stats?.instructors ?? 0} />
              <StatTile label="Courses" value={stats?.courses ?? 0} />
              <StatTile label="Orders" value={stats?.orders ?? 0} />
              <StatTile label="Revenue" value={money(stats?.revenue ?? 0)} />
            </div>

            {analytics && (
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <div className="card p-5 lg:col-span-2">
                  <h3 className="font-semibold">Enrollments — last 30 days</h3>
                  <div className="mt-4 text-brand">
                    <LineChart data={analytics.enrollmentsByDay.map((d) => ({ label: d.date, value: d.count }))} />
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="font-semibold">Top courses</h3>
                  <div className="mt-4">
                    <BarList data={analytics.topCourses.map((c) => ({ label: c.title, value: c.enrollments }))} />
                  </div>
                </div>
                <div className="card p-5 lg:col-span-3">
                  <h3 className="font-semibold">Revenue — last 30 days</h3>
                  <div className="mt-4 text-accent">
                    <LineChart
                      data={analytics.revenueByDay.map((d) => ({ label: d.date, value: d.amount }))}
                      color="rgb(var(--brand-secondary))"
                      formatValue={money}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {loading && tab !== 'overview' && <div className="text-muted">Loading…</div>}

        {tab === 'courses' && !loading && (
          <ModTable
            rows={rows}
            empty="No courses awaiting review."
            render={(c) => (
              <>
                <div className="flex-1">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-sm text-muted">by {c.instructor?.name} · {c._count?.chapters} sections</div>
                </div>
                <Approve onApprove={() => act(`/admin/courses/${c.id}/approve`)} onReject={() => act(`/admin/courses/${c.id}/reject`)} />
              </>
            )}
          />
        )}

        {tab === 'instructors' && !loading && (
          <ModTable
            rows={rows}
            empty="No instructors awaiting approval."
            render={(i) => (
              <>
                <div className="flex-1">
                  <div className="font-semibold">{i.name}</div>
                  <div className="text-sm text-muted">{i.email} · {i._count?.courses} courses</div>
                </div>
                <Approve onApprove={() => act(`/admin/instructors/${i.id}/approve`)} onReject={() => act(`/admin/instructors/${i.id}/reject`)} />
              </>
            )}
          />
        )}

        {tab === 'reviews' && !loading && (
          <ModTable
            rows={rows}
            empty="No reviews awaiting moderation."
            render={(r) => (
              <>
                <div className="flex-1">
                  <div className="text-sm text-amber-500">{'★'.repeat(r.rating)}</div>
                  <div className="font-medium">{r.review}</div>
                  <div className="text-sm text-muted">{r.user?.name} on {r.course?.title}</div>
                </div>
                <Approve onApprove={() => act(`/admin/reviews/${r.id}/approve`)} onReject={() => act(`/admin/reviews/${r.id}/reject`)} />
              </>
            )}
          />
        )}

        {tab === 'withdraws' && !loading && (
          <ModTable
            rows={rows}
            empty="No withdrawal requests."
            render={(w) => (
              <>
                <div className="flex-1">
                  <div className="font-semibold">{money(w.amount)}</div>
                  <div className="text-sm text-muted">{w.instructor?.name} · balance {money(w.instructor?.wallet ?? 0)}</div>
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
      </div>
    </div>
  );
}

function ModTable({ rows, render, empty }: { rows: any[]; render: (r: any) => React.ReactNode; empty: string }) {
  if (rows.length === 0) return <div className="card p-12 text-center text-muted">{empty}</div>;
  return (
    <div className="card divide-y divide-line">
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
      <button onClick={onReject} className="btn border border-line px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">Reject</button>
    </div>
  );
}
