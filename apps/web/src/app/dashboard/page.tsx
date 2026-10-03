'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Award, BookOpen, CheckCircle2, Clock, GraduationCap, LayoutDashboard,
  Lightbulb, ShieldCheck, Trophy,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { BarList } from '@/components/charts';
import { CourseCard } from '@/components/course-card';
import { CourseThumb } from '@/components/ui';
import { DirectoryShell } from '@/components/directory-shell';
import type { CourseCard as Course } from '@/lib/types';

interface EnrolledCourse {
  id: number; title: string; slug: string; thumbnail?: string;
  instructor: { name: string }; progress: number; completedLessons: number; totalLessons: number;
}
interface StudentStats { enrolledCourses: number; completedLessons: number; reviews: number }

function StatCard({ icon: Icon, tint, value, label }: { icon: any; tint: string; value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
      </div>
      <div className="mt-3 font-display text-4xl font-semibold text-ink">{value}</div>
      <div className="mt-1 text-[13px] text-muted">{label}</div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [recommended, setRecommended] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard'); return; }
    if (user.principal === 'instructor') { router.push('/dashboard/instructor'); return; }
    Promise.all([
      api<EnrolledCourse[]>('/learn').catch(() => []),
      api<StudentStats>('/dashboard/student').catch(() => null),
      api<{ data: Course[] } | Course[]>('/courses?perPage=4', { auth: false }).catch(() => null),
    ]).then(([c, s, r]) => {
      setCourses(c ?? []);
      setStats(s);
      setRecommended(r ? (Array.isArray(r) ? r : r.data) ?? [] : []);
      setLoading(false);
    });
  }, [user, authLoading]);

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const inProgress = courses.filter((c) => c.progress > 0 && c.progress < 100);
  const completed = courses.filter((c) => c.progress >= 100);
  const visible = (inProgress.length ? inProgress : courses).filter((c) =>
    c.title.toLowerCase().includes(filter.toLowerCase()),
  );
  const avgProgress = courses.length
    ? Math.round(courses.reduce((n, c) => n + c.progress, 0) / courses.length)
    : 0;

  return (
    <DirectoryShell
      eyebrow="Student Workspace"
      sections={[
        {
          heading: 'Learn',
          links: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/courses', label: 'Browse Courses', icon: BookOpen },
            { href: '/become-instructor', label: 'Become an Instructor', icon: GraduationCap },
            ...(user?.principal === 'admin'
              ? [{ href: '/dashboard/admin', label: 'Admin Portal', icon: ShieldCheck }]
              : []),
          ],
        },
      ]}
      userName={user?.name ?? 'Student'}
      userCaption="Student"
      userImage={user?.image}
      onLogout={logout}
      searchPlaceholder="Search my courses…"
      searchValue={filter}
      onSearch={setFilter}
    >
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
                Welcome back, {user?.name?.split(' ')[0]}! <span aria-hidden>👋</span>
              </h1>
              <p className="mt-1.5 text-[15px] text-muted">
                You&apos;re averaging {avgProgress}% completion across your courses. Keep it up!
              </p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={BookOpen} tint="bg-blue-500/10 text-brand" value={stats?.enrolledCourses ?? 0} label="Courses in Progress" />
            <StatCard icon={CheckCircle2} tint="bg-green-500/10 text-green-600" value={stats?.completedLessons ?? 0} label="Completed Lessons" />
            <StatCard icon={Clock} tint="bg-brand-soft text-brand" value={completed.length} label="Courses Completed" />
            <StatCard icon={Trophy} tint="bg-amber-500/10 text-amber-500" value={stats?.reviews ?? 0} label="Reviews Written" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              {/* Learning activity (real per-course progress) */}
              <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Learning Activity</h2>
                    <p className="text-[13px] text-muted">Your progress across enrolled courses</p>
                  </div>
                </div>
                <div className="mt-4">
                  {courses.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">Enroll in a course to start tracking activity.</p>
                  ) : (
                    <BarList
                      data={courses.slice(0, 7).map((c) => ({ label: c.title, value: c.progress }))}
                      formatValue={(n) => `${n}%`}
                    />
                  )}
                </div>
              </div>

              {/* Continue learning */}
              <div className="mt-8 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-brand">▶</span>
                  Continue Learning
                </h2>
                <Link href="/courses" className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  View All Courses <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {courses.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-line bg-card p-12 text-center shadow-sm">
                  <p className="text-muted">You haven&apos;t enrolled in any courses yet.</p>
                  <Link href="/courses" className="btn-primary mt-4 rounded-full">Explore courses</Link>
                </div>
              ) : (
                <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
                      <div className="aspect-[16/9] overflow-hidden">
                        <CourseThumb src={c.thumbnail} seed={c.id} alt={c.title} />
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <p className="text-[13px] font-semibold text-brand">{c.instructor.name}</p>
                        <h3 className="mt-0.5 line-clamp-1 text-[17px] font-bold text-ink">{c.title}</h3>
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-muted">Overall Progress</span>
                            <span className="font-bold text-ink">{c.progress}%</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                            <div className="h-full rounded-full bg-gradient-to-r from-brand to-green-500" style={{ width: `${c.progress}%` }} />
                          </div>
                          <p className="mt-1.5 text-xs text-muted">{c.completedLessons}/{c.totalLessons} lessons · Next up</p>
                        </div>
                        <div className="mt-4 flex gap-2 border-t border-line pt-3">
                          <Link href={`/learn/${c.slug}`} className="flex-1 rounded-full border border-line py-2 text-center text-[13px] font-semibold text-ink transition hover:border-brand hover:text-brand">
                            Syllabus
                          </Link>
                          <Link href={`/learn/${c.slug}`} className="flex-1 rounded-full bg-brand py-2 text-center text-[13px] font-bold text-white transition hover:brightness-110">
                            {c.progress >= 100 ? 'Review' : 'Resume'}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommended */}
              {recommended.length > 0 && (
                <>
                  <div className="mt-10 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-ink">↗ Recommended For You</h2>
                    <Link href="/courses" className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                      Based on your skills <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {recommended.slice(0, 4).map((c) => (
                      <CourseCard key={c.id} course={c} badge="Bestseller" />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right rail */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
                <h3 className="flex items-center gap-2 font-bold text-ink"><Award className="h-4 w-4 text-amber-500" /> Your Progress</h3>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted">Average completion</span>
                  <span className="font-bold text-ink">{avgProgress}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand to-green-500" style={{ width: `${avgProgress}%` }} />
                </div>
                <p className="mt-2 text-center text-[13px] text-muted">
                  {inProgress.length > 0 ? `${inProgress.length} course${inProgress.length > 1 ? 's' : ''} in progress — keep going!` : 'Enroll in a course to begin!'}
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-gradient-to-b from-amber-500/[0.07] to-card p-6 shadow-sm">
                <h3 className="flex items-center gap-2 font-bold text-ink"><Trophy className="h-4 w-4 text-amber-500" /> Recent Badges</h3>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { icon: Trophy, tint: 'bg-amber-500/10 text-amber-500', label: `${completed.length} Done` },
                    { icon: Award, tint: 'bg-slate-500/10 text-slate-500', label: `${stats?.completedLessons ?? 0} Lessons` },
                    { icon: CheckCircle2, tint: 'bg-orange-500/10 text-orange-500', label: `${inProgress.length} Active` },
                  ].map((b) => (
                    <div key={b.label}>
                      <span className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${b.tint}`}>
                        <b.icon className="h-5 w-5" />
                      </span>
                      <span className="mt-1.5 block text-[11px] font-semibold text-ink">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-green-500/[0.08] p-6">
                <h3 className="flex items-center gap-2 font-bold text-ink"><Lightbulb className="h-4 w-4 text-green-600" /> Study Tip of the Day</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
                  The Pomodoro Technique: Study for 25 minutes, then take a 5-minute break. This keeps your
                  brain fresh and helps maintain peak focus.
                </p>
              </div>
            </div>
          </div>
    </DirectoryShell>
  );
}
