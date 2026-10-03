'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BadgeCheck, BookOpen, CheckCircle2, ChevronDown, Clock, FileText, Globe, Heart, Infinity as InfinityIcon,
  MessageCircle, MonitorSmartphone, Play, Share2, Star, Trophy, Users,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { priceLabel } from '@/lib/types';
import { CourseCard } from '@/components/course-card';
import { CourseThumb, Stars } from '@/components/ui';
import type { CourseCard as Course } from '@/lib/types';

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

const HERO_BG = 'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=1800&q=80&auto=format&fit=crop';

export default function CourseDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const branding = useBranding();
  const { user } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [related, setRelated] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [openChapters, setOpenChapters] = useState<Set<number>>(new Set([0]));
  const [showAllSections, setShowAllSections] = useState(false);

  useEffect(() => {
    api<CourseDetail>(`/courses/${slug}`, { auth: false })
      .then((c) => {
        setCourse(c);
        api<{ data: Course[] } | Course[]>(`/courses?perPage=4`, { auth: false })
          .then((r) => setRelated(((Array.isArray(r) ? r : r.data) ?? []).filter((x) => x.slug !== slug).slice(0, 3)))
          .catch(() => {});
      })
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
  const discountPct = course.price && course.discount ? Math.round((course.discount / course.price) * 100) : 0;
  const visibleChapters = showAllSections ? course.chapters : course.chapters.slice(0, 3);
  const hiddenCount = course.chapters.length - visibleChapters.length;

  const toggleChapter = (i: number) =>
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="bg-surface">
      {/* ── Dark hero ── */}
      <div className="relative overflow-hidden bg-[#101418] text-white">
        <img src={HERO_BG} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#101418] via-[#101418]/80 to-[#101418]/30" />
        <div className="container-page relative py-14 lg:py-20">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400">Best Seller</span>
            {course.category && (
              <span className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold text-white/90">
                {course.category.name}
              </span>
            )}
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {course.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/70">
            {course.description?.slice(0, 220)}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-green-400">
              <Star className="h-4 w-4 fill-current" /> {course.averageRating.toFixed(1)}
              <span className="font-normal text-white/60">({course._count.reviews.toLocaleString()} reviews)</span>
            </span>
            <span className="flex items-center gap-1.5 text-white/80"><Users className="h-4 w-4" /> {course._count.enrollments.toLocaleString()} students</span>
            <span className="flex items-center gap-1.5 text-white/80"><Globe className="h-4 w-4" /> {course.language?.name ?? 'English'}</span>
          </div>
          <p className="mt-5 text-sm text-white/60">
            Created by <span className="font-semibold text-white underline underline-offset-2">{course.instructor.name}</span>
            <span className="ml-3">Last updated June 2024</span>
          </p>
        </div>
      </div>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        {/* ── Main column ── */}
        <div className="min-w-0">
          {/* What you'll learn */}
          <section className="rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold text-ink">What you'll learn</h2>
            <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {(course.description
                ? course.description.split('. ').slice(0, 6).map((s) => s.trim()).filter(Boolean)
                : ['Build real-world projects with expert guidance', 'Master core concepts step by step', 'Learn industry best practices', 'Prepare for certification']
              ).map((point, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink/75">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                  {point.endsWith('.') ? point : `${point}.`}
                </li>
              ))}
            </ul>
          </section>

          {/* Course content */}
          <section className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold text-ink">Course content</h2>
              <p className="text-sm text-muted">
                {course.chapters.length} sections · {totalLessons} lectures · {course.duration ?? '12h 30m'} total length
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {visibleChapters.map((ch, i) => {
                const open = openChapters.has(i);
                return (
                  <div key={ch.id} className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
                    <button onClick={() => toggleChapter(i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-surface">
                      <span className="font-bold text-ink">Module {i + 1}: {ch.title}</span>
                      <span className="flex shrink-0 items-center gap-3 text-sm text-muted">
                        {ch.lessons.length * 15}m
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {open && (
                      <ul className="divide-y divide-line border-t border-line">
                        {ch.lessons.map((l) => (
                          <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="text-brand">{l.fileType === 'video' ? <Play className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span>
                              <span className="truncate text-ink/80">{l.title}</span>
                              {l.isPreview && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">Preview</span>}
                            </span>
                            <span className="shrink-0 text-muted">{l.duration}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            {hiddenCount > 0 && !showAllSections && (
              <button onClick={() => setShowAllSections(true)} className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                Show {hiddenCount} more sections <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </section>

          {/* Description */}
          {course.description && (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-ink">Description</h2>
              <p className="mt-3 leading-relaxed text-muted">{course.description}</p>
              <h3 className="mt-6 font-bold text-ink">Who this course is for:</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
                <li>Learners looking to build job-ready skills in {course.category?.name ?? 'this subject'}.</li>
                <li>Professionals wanting to level up and stay competitive.</li>
                <li>Anyone preparing for interviews, freelancing, or certification.</li>
              </ul>
            </section>
          )}

          {/* Instructor */}
          <section className="mt-10">
            <h2 className="text-xl font-bold text-ink">Instructor</h2>
            <div className="mt-4 flex items-center gap-4">
              {course.instructor.image ? (
                <img src={course.instructor.image} alt={course.instructor.name} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-soft text-2xl font-bold text-brand">
                  {course.instructor.name[0]}
                </span>
              )}
              <div>
                <div className="text-lg font-bold text-brand">{course.instructor.name}</div>
                <div className="text-sm text-muted">{course.instructor.headline ?? 'Senior Instructor & Educator'}</div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span>★ {(course.averageRating ?? 0).toFixed(1)} Instructor Rating</span>
                  <span>◉ {course._count.enrollments.toLocaleString()} Students</span>
                </div>
              </div>
            </div>
            {course.instructor.bio && <p className="mt-4 leading-relaxed text-muted">{course.instructor.bio}</p>}
          </section>

          {/* Reviews */}
          <section className="mt-10">
            <h2 className="text-xl font-bold text-ink">Student reviews</h2>
            {course.reviews.length === 0 ? (
              <p className="mt-3 text-muted">No reviews yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {course.reviews.slice(0, 5).map((r) => (
                  <div key={r.id} className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-semibold text-brand">
                        {r.user.name[0]}
                      </span>
                      <span className="font-semibold text-ink">{r.user.name}</span>
                      <span className="ml-auto"><Stars rating={r.rating} /></span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{r.review}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Sticky purchase card ── */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-lift">
              <div className="relative aspect-video">
                <CourseThumb src={course.thumbnail} seed={course.id} alt={course.title} />
                <span className="absolute inset-0 grid place-items-center bg-black/25 text-sm font-semibold text-white">
                  Preview this course
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-ink">{priceLabel(course, currency)}</span>
                  {(course.discount ?? 0) > 0 && (
                    <>
                      <span className="text-muted line-through">
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(course.price ?? 0)}
                      </span>
                      <span className="text-sm font-bold text-green-600">{discountPct}% OFF</span>
                    </>
                  )}
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-red-500">
                  <Clock className="h-3.5 w-3.5" /> 2 days left at this price!
                </p>
                <button onClick={addToCart} disabled={busy} className="btn-primary mt-4 w-full rounded-xl py-3.5 text-[15px]">
                  {busy ? 'Adding…' : 'Add to Cart'}
                </button>
                <Link href="/cart" className="mt-2.5 block rounded-xl border border-brand/40 py-3.5 text-center text-[15px] font-bold text-brand transition hover:bg-brand-soft">
                  Buy Now
                </Link>
                {msg && <p className="mt-3 text-center text-sm font-medium text-brand">{msg}</p>}
                <p className="mt-3 text-center text-[13px] text-muted">30-Day Money-Back Guarantee</p>

                <h3 className="mt-5 text-sm font-bold text-ink">This course includes:</h3>
                <ul className="mt-2.5 space-y-2 text-sm text-muted">
                  <li className="flex items-center gap-2.5"><Play className="h-4 w-4 text-muted" /> {course.duration ?? '12.5 hours'} on-demand video</li>
                  <li className="flex items-center gap-2.5"><BookOpen className="h-4 w-4 text-muted" /> {totalLessons} downloadable resources</li>
                  <li className="flex items-center gap-2.5"><InfinityIcon className="h-4 w-4 text-muted" /> Full lifetime access</li>
                  <li className="flex items-center gap-2.5"><MonitorSmartphone className="h-4 w-4 text-muted" /> Access on mobile and TV</li>
                  {course.certificate && <li className="flex items-center gap-2.5"><Trophy className="h-4 w-4 text-muted" /> Certificate of completion</li>}
                </ul>

                <div className="mt-5 flex items-center justify-center gap-8 border-t border-line pt-4 text-sm font-semibold text-ink">
                  <button className="flex items-center gap-1.5 hover:text-brand"><Heart className="h-4 w-4" /> Wishlist</button>
                  <button className="flex items-center gap-1.5 hover:text-brand"><Share2 className="h-4 w-4" /> Share</button>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-surface px-6 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-green-500/30 bg-green-500/10 text-green-600">
                  <BadgeCheck className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-bold text-ink">Verified Certificate</div>
                  <div className="text-xs text-muted">Sharable on LinkedIn and Resume</div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div className="text-sm">
                <div className="font-bold text-ink">Have questions?</div>
                <div className="text-muted">Chat with an education expert</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Students also bought */}
      {related.length > 0 && (
        <div className="border-t border-line bg-[#f4f5f7]">
          <div className="container-page py-12">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink">Students also bought</h2>
              <Link href="/courses" className="text-sm font-semibold text-brand hover:underline">View all</Link>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
