'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, BookOpen, CheckCircle2, Circle, Clock, GraduationCap, Layers,
  LayoutDashboard, Library, PlayCircle, ShieldCheck, Trophy,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { CourseThumb } from '@/components/ui';
import { DirectoryShell } from '@/components/directory-shell';

interface LessonRef { id: number; title: string; completed: boolean }
interface Module {
  id: number; title: string; order: number; totalLessons: number;
  completedLessons: number; completed: boolean; lessons: LessonRef[];
}
interface EnrolledCourse {
  id: number; title: string; slug: string; thumbnail?: string | null;
  instructor: { name: string; image?: string | null };
  modules: Module[]; totalModules: number; completedModules: number;
  progress: number; completedLessons: number; totalLessons: number;
  nextLesson: { id: number; title: string; moduleId: number | null; moduleTitle: string | null } | null;
  lastActivityAt: string | null; enrolledAt: string;
}

type Filter = 'all' | 'in-progress' | 'not-started' | 'completed';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All courses' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'not-started', label: 'Not started' },
  { id: 'completed', label: 'Completed' },
];

function StatCard({ icon: Icon, tint, value, label }: { icon: any; tint: string; value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
      <div className="mt-3 font-display text-3xl font-semibold text-ink">{value}</div>
      <div className="mt-1 text-[13px] text-muted">{label}</div>
    </div>
  );
}

function statusOf(c: EnrolledCourse): Exclude<Filter, 'all'> {
  if (c.progress >= 100) return 'completed';
  if (c.progress > 0 || c.completedLessons > 0) return 'in-progress';
  return 'not-started';
}

export default function MyLearningPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard/my-learning'); return; }
    if (user.principal === 'admin') { router.push('/dashboard/admin'); return; }
    if (user.principal === 'instructor') { router.push('/dashboard/instructor'); return; }
    api<EnrolledCourse[]>('/learn')
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const totals = useMemo(() => {
    const lessons = courses.reduce((n, c) => n + c.totalLessons, 0);
    const completed = courses.reduce((n, c) => n + c.completedLessons, 0);
    return {
      courses: courses.length,
      modules: courses.reduce((n, c) => n + c.totalModules, 0),
      completedLessons: completed,
      lessons,
      avgProgress: lessons ? Math.round((completed / lessons) * 100) : 0,
    };
  }, [courses]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: courses.length, 'in-progress': 0, 'not-started': 0, completed: 0 };
    for (const course of courses) c[statusOf(course)] += 1;
    return c;
  }, [courses]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (filter !== 'all' && statusOf(c) !== filter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.instructor.name.toLowerCase().includes(q) ||
        c.modules.some((m) => m.title.toLowerCase().includes(q))
      );
    });
  }, [courses, filter, search]);

  const toggle = (id: number) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <DirectoryShell
      eyebrow="Student Workspace"
      sections={[
        {
          heading: 'Learn',
          links: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: '' },
            { href: '/dashboard/my-learning', label: 'My Learning', icon: Library },
            { href: '/courses', label: 'Browse Courses', icon: BookOpen },
            { href: '/become-instructor', label: 'Become an Instructor', icon: GraduationCap },
          ],
        },
        {
          heading: 'Account',
          links: [
            { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
          ],
        },
      ]}
      userName={user?.name ?? 'Student'}
      userCaption="Student"
      userImage={user?.image}
      onLogout={logout}
      searchPlaceholder="Search my courses and modules…"
      searchValue={search}
      onSearch={setSearch}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">My Learning</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            Every course you own, with its modules and lesson progress in one place.
          </p>
        </div>
        <Link href="/courses" className="btn-primary rounded-full text-sm">
          Browse more courses <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Library} tint="bg-blue-500/10 text-brand" value={totals.courses} label="Courses purchased" />
        <StatCard icon={Layers} tint="bg-purple-500/10 text-purple-600" value={totals.modules} label="Modules unlocked" />
        <StatCard icon={CheckCircle2} tint="bg-green-500/10 text-green-600" value={`${totals.completedLessons}/${totals.lessons}`} label="Lessons completed" />
        <StatCard icon={Trophy} tint="bg-amber-500/10 text-amber-500" value={`${totals.avgProgress}%`} label="Average progress" />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              filter === f.id ? 'bg-ink text-white shadow' : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            {f.label} <span className={filter === f.id ? 'text-white/70' : 'text-muted'}>({counts[f.id]})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-card p-12 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
            <Library className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-ink">
            {courses.length === 0 ? 'You have not purchased any courses yet' : 'No courses match this view'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {courses.length === 0
              ? 'Buy a course and it will appear here with all of its modules.'
              : 'Try another filter or clear the search to see the rest of your library.'}
          </p>
          {courses.length === 0 ? (
            <Link href="/courses" className="btn-primary mt-4 rounded-full">Explore courses</Link>
          ) : (
            <button onClick={() => { setFilter('all'); setSearch(''); }} className="btn-ghost mt-4 rounded-full">
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {visible.map((c) => {
            const open = expanded.has(c.id);
            const status = statusOf(c);
            const cta = status === 'completed' ? 'Review course' : status === 'not-started' ? 'Start learning' : 'Resume';
            return (
              <article key={c.id} className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
                <div className="relative aspect-[16/7] overflow-hidden">
                  <CourseThumb src={c.thumbnail} seed={c.id} alt={c.title} />
                  <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    {status === 'completed' ? 'Completed' : status === 'not-started' ? 'Not started' : `${c.progress}% complete`}
                  </span>
                </div>

                <div className="p-5">
                  <p className="text-[13px] font-semibold text-brand">{c.instructor.name}</p>
                  <h2 className="mt-0.5 line-clamp-1 text-xl font-bold text-ink">{c.title}</h2>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
                    <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> {c.totalModules} modules</span>
                    <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> {c.totalLessons} lessons</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {c.completedLessons} done</span>
                    {c.lastActivityAt && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Last opened {new Date(c.lastActivityAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted">
                        {c.completedModules}/{c.totalModules} modules · {c.completedLessons}/{c.totalLessons} lessons
                      </span>
                      <span className="font-bold text-ink">{c.progress}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand to-green-500" style={{ width: `${c.progress}%` }} />
                    </div>
                    {c.nextLesson && (
                      <p className="mt-2 truncate text-xs text-muted">
                        Up next: <span className="font-semibold text-ink/80">{c.nextLesson.title}</span>
                        {c.nextLesson.moduleTitle ? ` · ${c.nextLesson.moduleTitle}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={c.nextLesson ? `/learn/${c.slug}?lesson=${c.nextLesson.id}` : `/learn/${c.slug}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110">
                      <PlayCircle className="h-4 w-4" /> {cta}
                    </Link>
                    <Link href={`/courses/${c.slug}`} className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-brand hover:text-brand">
                      Details
                    </Link>
                    <button
                      onClick={() => toggle(c.id)}
                      aria-expanded={open}
                      className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-brand hover:text-brand"
                    >
                      {open ? 'Hide modules' : 'View modules'}
                    </button>
                  </div>

                  {open && (
                    <div className="mt-4 space-y-2 border-t border-line pt-4">
                      {c.modules.length === 0 ? (
                        <p className="text-sm text-muted">No modules have been published for this course yet.</p>
                      ) : (
                        c.modules.map((m, idx) => (
                          <div key={m.id} className="rounded-xl border border-line bg-surface/60">
                            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                              <div className="flex min-w-0 items-center gap-2">
                                {m.completed ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                                ) : (
                                  <Circle className="h-4 w-4 shrink-0 text-muted" />
                                )}
                                <span className="truncate text-[13px] font-semibold text-ink">
                                  Module {String(idx + 1).padStart(2, '0')} · {m.title}
                                </span>
                              </div>
                              <span className="shrink-0 text-[11px] font-semibold text-muted">
                                {m.completedLessons}/{m.totalLessons}
                              </span>
                            </div>
                            {m.lessons.length > 0 && (
                              <ul className="border-t border-line/70 px-4 py-2">
                                {m.lessons.map((l) => (
                                  <li key={l.id}>
                                    <Link
                                      href={`/learn/${c.slug}?lesson=${l.id}`}
                                      className="flex items-center gap-2 rounded-lg py-1 text-[12px] text-muted transition hover:text-brand"
                                    >
                                      {l.completed ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                      ) : (
                                        <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                                      )}
                                      <span className={`truncate ${l.completed ? 'line-through opacity-70' : 'text-ink/80'}`}>{l.title}</span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </DirectoryShell>
  );
}
