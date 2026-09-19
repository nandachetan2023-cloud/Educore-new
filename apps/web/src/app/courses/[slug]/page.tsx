'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { priceLabel } from '@/lib/types';

interface Lesson { id: number; title: string; duration: string; fileType: string; isPreview: boolean }
interface Chapter { id: number; title: string; lessons: Lesson[] }
interface CourseDetail {
  id: number; title: string; slug: string; description?: string; thumbnail?: string;
  price?: number; discount?: number; duration?: string; certificate?: boolean;
  instructor: { id: number; name: string; image?: string; headline?: string; bio?: string };
  category?: { name: string }; level?: { name: string }; language?: { name: string };
  chapters: Chapter[];
  reviews: { id: number; rating: number; review: string; user: { name: string; image?: string } }[];
  averageRating: number;
  _count: { enrollments: number; reviews: number };
}

export default function CourseDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const branding = useBranding();
  const { user } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api<CourseDetail>(`/courses/${slug}`, { auth: false })
      .then(setCourse)
      .catch(() => setCourse(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const addToCart = async () => {
    if (!user) return router.push(`/login?next=/courses/${slug}`);
    if (!course) return;
    setBusy(true);
    setMsg(null);
    try {
      await api(`/cart/${course.id}`, { method: 'POST' });
      setMsg('Added to cart!');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="container-page py-20 text-center text-muted">Loading course…</div>;
  if (!course) return <div className="container-page py-20 text-center text-muted">Course not found.</div>;

  const currency = branding?.currency ?? 'USD';
  const totalLessons = course.chapters.reduce((n, c) => n + c.lessons.length, 0);

  return (
    <div>
      {/* Header band */}
      <div className="border-b border-line bg-gradient-to-b from-brand-soft to-transparent">
        <div className="container-page grid gap-8 py-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {course.category && <span className="badge">{course.category.name}</span>}
            <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{course.title}</h1>
            <p className="mt-4 max-w-2xl text-muted">{course.description?.slice(0, 220)}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted">
              <span className="font-semibold text-ink">★ {course.averageRating.toFixed(1)}</span>
              <span>({course._count.reviews} reviews)</span>
              <span>· {course._count.enrollments} students</span>
              {course.level && <span>· {course.level.name}</span>}
              {course.language && <span>· {course.language.name}</span>}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white">
                {course.instructor.name[0]}
              </div>
              <div>
                <div className="text-sm font-semibold">{course.instructor.name}</div>
                <div className="text-xs text-muted">{course.instructor.headline ?? 'Instructor'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-10 lg:col-span-2">
          <section>
            <h2 className="text-xl font-bold">Course content</h2>
            <p className="mt-1 text-sm text-muted">
              {course.chapters.length} sections · {totalLessons} lessons
            </p>
            <div className="mt-4 space-y-3">
              {course.chapters.map((ch) => (
                <details key={ch.id} className="card overflow-hidden" open>
                  <summary className="cursor-pointer list-none px-5 py-4 font-semibold hover:bg-brand-soft/40">
                    {ch.title}
                    <span className="ml-2 text-sm font-normal text-muted">({ch.lessons.length})</span>
                  </summary>
                  <ul className="divide-y divide-line border-t border-line">
                    {ch.lessons.map((l) => (
                      <li key={l.id} className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="text-muted">{l.fileType === 'video' ? '▶' : '📄'}</span>
                          {l.title}
                          {l.isPreview && <span className="badge">Preview</span>}
                        </span>
                        <span className="text-muted">{l.duration}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          {course.instructor.bio && (
            <section>
              <h2 className="text-xl font-bold">About the instructor</h2>
              <p className="mt-3 text-muted">{course.instructor.bio}</p>
            </section>
          )}

          <section>
            <h2 className="text-xl font-bold">Student reviews</h2>
            {course.reviews.length === 0 ? (
              <p className="mt-3 text-muted">No reviews yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {course.reviews.map((r) => (
                  <div key={r.id} className="card p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-semibold text-brand">
                        {r.user.name[0]}
                      </div>
                      <div className="font-semibold">{r.user.name}</div>
                      <div className="ml-auto text-sm text-amber-500">{'★'.repeat(r.rating)}</div>
                    </div>
                    <p className="mt-3 text-sm text-muted">{r.review}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Purchase sidebar */}
        <aside className="lg:col-span-1">
          <div className="card sticky top-24 overflow-hidden">
            <div className="aspect-video bg-brand-soft">
              {course.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-5xl font-black text-brand/30">
                  {course.title[0]}
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="text-3xl font-extrabold">{priceLabel(course, currency)}</div>
              <button onClick={addToCart} disabled={busy} className="btn-primary mt-5 w-full py-3">
                {busy ? 'Adding…' : 'Add to cart'}
              </button>
              <Link href="/cart" className="btn-ghost mt-3 w-full py-3">Go to cart</Link>
              {msg && <p className="mt-3 text-center text-sm text-brand">{msg}</p>}

              <ul className="mt-6 space-y-2 text-sm text-muted">
                <li>✓ {totalLessons} lessons</li>
                {course.duration && <li>✓ {course.duration} total</li>}
                <li>✓ Full lifetime access</li>
                {course.certificate && <li>✓ Certificate of completion</li>}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
