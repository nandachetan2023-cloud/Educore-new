'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { StatTile } from '@/components/stat-tile';

interface EnrolledCourse {
  id: number; title: string; slug: string; thumbnail?: string;
  instructor: { name: string }; progress: number; completedLessons: number; totalLessons: number;
}
interface StudentStats { enrolledCourses: number; completedLessons: number; reviews: number }

export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/dashboard'); return; }
    if (user.principal === 'instructor') { router.push('/dashboard/instructor'); return; }
    Promise.all([
      api<EnrolledCourse[]>('/learn').catch(() => []),
      api<StudentStats>('/dashboard/student').catch(() => null),
    ]).then(([c, s]) => {
      setCourses(c ?? []);
      setStats(s);
      setLoading(false);
    });
  }, [user, authLoading]);

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const inProgress = courses.filter((c) => c.progress > 0 && c.progress < 100);
  const notStarted = courses.filter((c) => c.progress === 0);
  const completed = courses.filter((c) => c.progress >= 100);
  const continueCourse = inProgress[0];

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-extrabold">Hi, {user?.name?.split(' ')[0]} 👋</h1>
      <p className="mt-1 text-muted">Continue where you left off.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Enrolled courses" value={stats?.enrolledCourses ?? 0} />
        <StatTile label="Lessons completed" value={stats?.completedLessons ?? 0} />
        <StatTile label="Reviews written" value={stats?.reviews ?? 0} />
      </div>

      {continueCourse && (
        <Link
          href={`/learn/${continueCourse.slug}`}
          className="card group mt-10 flex flex-col gap-6 overflow-hidden p-6 transition hover:shadow-lift sm:flex-row sm:items-center"
        >
          <div className="aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-brand-soft sm:w-64">
            {continueCourse.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={continueCourse.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-3xl font-black text-brand/30">{continueCourse.title[0]}</div>
            )}
          </div>
          <div className="flex-1">
            <span className="badge">Continue learning</span>
            <h3 className="mt-2 text-xl font-bold group-hover:text-brand">{continueCourse.title}</h3>
            <p className="mt-1 text-sm text-muted">{continueCourse.instructor.name}</p>
            <div className="mt-4 max-w-sm">
              <div className="h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${continueCourse.progress}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-muted">
                {continueCourse.progress}% · {continueCourse.completedLessons}/{continueCourse.totalLessons} lessons
              </div>
            </div>
            <span className="btn-primary mt-5 inline-flex">Resume course →</span>
          </div>
        </Link>
      )}

      {courses.length === 0 ? (
        <div className="card mt-10 p-12 text-center">
          <p className="text-muted">You haven&apos;t enrolled in any courses yet.</p>
          <Link href="/courses" className="btn-primary mt-4">Explore courses</Link>
        </div>
      ) : (
        <>
          {inProgress.length > 0 && (
            <CourseSection title="In progress" courses={inProgress} />
          )}
          {notStarted.length > 0 && (
            <CourseSection title="Not started" courses={notStarted} />
          )}
          {completed.length > 0 && (
            <CourseSection title="Completed" courses={completed} />
          )}
        </>
      )}
    </div>
  );
}

function CourseSection({ title, courses }: { title: string; courses: EnrolledCourse[] }) {
  return (
    <>
      <h2 className="mt-12 text-xl font-bold">{title}</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <Link key={c.id} href={`/learn/${c.slug}`} className="card group overflow-hidden transition hover:shadow-lift">
            <div className="relative aspect-video bg-brand-soft">
              {c.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-3xl font-black text-brand/30">{c.title[0]}</div>
              )}
              {c.progress >= 100 && (
                <span className="badge absolute right-2 top-2 bg-green-500/90 text-white">✓ Completed</span>
              )}
            </div>
            <div className="p-4">
              <h3 className="line-clamp-2 font-semibold group-hover:text-brand">{c.title}</h3>
              <p className="mt-1 text-sm text-muted">{c.instructor.name}</p>
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${c.progress}%` }} />
                </div>
                <div className="mt-1.5 text-xs text-muted">
                  {c.progress}% · {c.completedLessons}/{c.totalLessons} lessons
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
