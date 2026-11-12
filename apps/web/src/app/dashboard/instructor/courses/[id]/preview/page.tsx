'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, PlayCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';

interface PreviewLesson {
  id: number;
  title: string;
  duration: string;
  fileType: string;
  isPreview: boolean;
  filePath: string;
}

interface PreviewChapter {
  id: number;
  title: string;
  order: number;
  lessons: PreviewLesson[];
}

interface PreviewCourse {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  thumbnail?: string | null;
  price?: number;
  discount?: number;
  status: string;
  isApproved: string;
  capacity?: number | null;
  certificate?: boolean | null;
  qna?: boolean | null;
  instructor: { name: string; headline?: string | null };
  category?: { name: string } | null;
  level?: { name: string } | null;
  language?: { name: string } | null;
  tags?: { id: number; name: string; slug: string }[];
  chapters: PreviewChapter[];
}

const ICONS: Record<string, string> = {
  video: 'play_circle',
  audio: 'audiotrack',
  pdf: 'picture_as_pdf',
  doc: 'article',
  file: 'description',
};

export default function CoursePreviewPage({ params }: { params: { id: string } }) {
  const courseId = Number(params.id);
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [course, setCourse] = useState<PreviewCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currency = branding?.currency ?? 'INR';
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') {
      router.push('/login?next=/dashboard/instructor/courses/' + courseId + '/preview');
      return;
    }
    api<PreviewCourse>(`/courses/preview/${courseId}`)
      .then(setCourse)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the preview'))
      .finally(() => setLoading(false));
  }, [user, authLoading, router, courseId]);

  if (authLoading || loading) {
    return <div className="container-page py-20 text-center text-muted">Loading preview…</div>;
  }

  if (error || !course) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-red-500">{error ?? 'Course not found'}</p>
        <Link href="/dashboard/instructor/courses" className="btn-ghost mt-4">Back to my courses</Link>
      </div>
    );
  }

  const lessons = course.chapters.reduce((n, c) => n + c.lessons.length, 0);
  const net = Math.max(0, (course.price ?? 0) - (course.discount ?? 0));

  return (
    <div className="min-h-screen bg-surface">
      <div className="border-b border-line bg-amber-500/10">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm font-semibold text-amber-800">Preview mode — only you can see this page until the course is published.</p>
          <Link href={`/dashboard/instructor/courses/${courseId}`} className="btn-ghost rounded-full text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to builder
          </Link>
        </div>
      </div>

      <div className="container-page py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              <img src={course.thumbnail || `https://picsum.photos/seed/educore-${course.id}/960/540`} alt="" className="h-56 w-full object-cover" />
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                  {course.category && <span className="badge">{course.category.name}</span>}
                  {course.level && <span className="badge">{course.level.name}</span>}
                  {course.language && <span className="badge">{course.language.name}</span>}
                  {(course.tags ?? []).map((tag) => <span key={tag.id} className="badge">{tag.name}</span>)}
                </div>
                <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">{course.title}</h1>
                <p className="mt-1 text-sm text-muted">by {course.instructor.name}{course.instructor.headline ? ` · ${course.instructor.headline}` : ''}</p>
                <p className="mt-4 whitespace-pre-line text-ink/80">{course.description || 'No description yet.'}</p>
              </div>
            </div>

            <h2 className="mt-8 text-lg font-bold text-ink">Curriculum ({course.chapters.length} sections · {lessons} lessons)</h2>
            {course.chapters.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-line bg-card p-10 text-center text-sm text-muted">
                No sections yet — add them in the builder.
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                {course.chapters.map((ch, i) => (
                  <div key={ch.id} className="overflow-hidden rounded-2xl border border-line bg-card">
                    <div className="bg-surface px-5 py-3 text-sm font-bold text-ink">{i + 1}. {ch.title}</div>
                    <ul className="divide-y divide-line">
                      {ch.lessons.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                          <span className="material-symbols-outlined text-lg text-brand">{ICONS[l.fileType] ?? 'play_circle'}</span>
                          <span className="min-w-0 flex-1 truncate text-ink">{l.title}</span>
                          {l.isPreview && <span className="badge bg-green-500/10 text-green-600">Free preview</span>}
                          <span className="flex items-center gap-1 text-xs text-muted"><Clock className="h-3.5 w-3.5" /> {l.duration}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-ink">{net === 0 ? 'Free' : money(net)}</span>
                {course.discount ? <span className="text-sm text-muted line-through">{money(course.price ?? 0)}</span> : null}
              </div>
              {course.capacity ? <p className="mt-1 text-xs text-muted">Limited to {course.capacity} learners</p> : null}
              <button disabled className="btn-primary mt-5 w-full rounded-xl py-3">Enroll now</button>
              <ul className="mt-5 space-y-2 text-[13px] text-ink/75">
                <li>▶ {lessons} lessons</li>
                <li>◷ Lifetime access</li>
                {course.certificate && <li>◉ Certificate of completion</li>}
                {course.qna && <li>? Q&A with the instructor</li>}
              </ul>
              <Link href={`/dashboard/instructor/courses/${courseId}`} className="btn-ghost mt-5 w-full rounded-xl">
                <PlayCircle className="h-4 w-4" /> Back to builder
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
