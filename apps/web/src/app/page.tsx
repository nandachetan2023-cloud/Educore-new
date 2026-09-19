'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useBranding } from '@/lib/providers';
import { CourseCard } from '@/components/course-card';
import { HeroCarousel } from '@/components/hero-carousel';
import type { CourseCard as Course, Category, Paginated, HomeCms } from '@/lib/types';

function Stars({ rating = 5 }: { rating?: number }) {
  return (
    <div className="flex gap-0.5 text-amber-400" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" fill={i < rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
          <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.8L10 14.9l-5.21 2.74 1-5.8-4.21-4.1 5.82-.85z" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    ),
    title: 'Find your course',
    desc: 'Browse hundreds of courses across design, development, business, and more.',
  },
  {
    step: '02',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
    title: 'Enroll & start learning',
    desc: 'One-click enrollment and immediate access to all course materials.',
  },
  {
    step: '03',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    ),
    title: 'Earn your certificate',
    desc: 'Complete the course and receive a shareable digital certificate.',
  },
];

const CATEGORY_ICONS: Record<string, string> = {
  design: '🎨', development: '💻', business: '💼', marketing: '📢',
  photography: '📷', music: '🎵', health: '🏃', finance: '💰',
  language: '🌍', data: '📊',
};

function getCategoryIcon(name: string) {
  const key = name.toLowerCase().split(' ')[0];
  return CATEGORY_ICONS[key] ?? '📚';
}

export default function HomePage() {
  const branding = useBranding();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cms, setCms] = useState<HomeCms | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Paginated<Course>>('/courses?perPage=8', { auth: false }).catch(() => null),
      api<Category[]>('/categories', { auth: false }).catch(() => []),
      api<HomeCms>('/cms/home', { auth: false }).catch(() => null),
    ]).then(([c, cats, home]) => {
      if (c) setCourses(c.data);
      setCategories(cats ?? []);
      setCms(home);
      setLoading(false);
    });
  }, []);

  const brandName = branding?.name ?? 'EduCore';

  return (
    <>
      {/* Hero */}
      <HeroCarousel
        title={
          <>
            Learn without limits with{' '}
            <span className="bg-gradient-to-r from-brand via-accent to-brand bg-clip-text text-transparent">
              {brandName}
            </span>
          </>
        }
        subtitle="Build in-demand skills with courses from expert instructors. Learn at your own pace, on any device, and earn certificates as you go."
        primaryHref="/courses"
        primaryLabel="Browse courses"
        secondaryHref="/become-instructor"
        secondaryLabel={`Teach on ${brandName}`}
      />

      {/* Trusted by */}
      {!!cms?.brands?.length && (
        <section className="border-b border-line bg-surface py-8">
          <div className="container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Trusted by learners at</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-50 grayscale">
              {cms.brands.slice(0, 6).map((b) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={b.id} src={b.image} alt="" className="h-6 w-auto object-contain" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      {!!cms?.counters?.length && (
        <section className="bg-brand py-14">
          <div className="container-page grid grid-cols-2 gap-8 sm:grid-cols-4">
            {cms.counters.map((c) => (
              <div key={c.id} className="text-center">
                <div className="text-4xl font-black text-white sm:text-5xl">{c.number}</div>
                <div className="mt-1 text-sm font-medium text-white/70">{c.title}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <section id="categories" className="container-page py-16">
          <div className="flex items-end justify-between">
            <div>
              <span className="badge">Explore</span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Top categories</h2>
            </div>
            <Link href="/courses" className="text-sm font-semibold text-brand hover:underline">All courses →</Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/courses?category=${cat.slug}`}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-line bg-card p-5 text-center transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lift"
              >
                {cat.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cat.icon} alt="" className="h-10 w-10 object-contain" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-2xl transition group-hover:bg-brand group-hover:text-white">
                    {getCategoryIcon(cat.name)}
                  </span>
                )}
                <div>
                  <div className="text-sm font-semibold group-hover:text-brand">{cat.name}</div>
                  <div className="mt-0.5 text-xs text-muted">{cat._count?.courses ?? 0} courses</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured courses */}
      <section className="bg-surface py-16">
        <div className="container-page">
          <div className="flex items-end justify-between">
            <div>
              <span className="badge">Catalog</span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Popular courses</h2>
            </div>
            <Link href="/courses" className="text-sm font-semibold text-brand hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card aspect-[3/4] animate-pulse bg-line/40" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-line py-20 text-center text-muted">
              No published courses yet. Check back soon!
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} featured />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-16">
        <div className="text-center">
          <span className="badge">Simple process</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">How it works</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">Get started in minutes. No prior experience needed.</p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="grid h-20 w-20 place-items-center rounded-3xl bg-brand-soft text-brand">
                  {step.icon}
                </div>
                <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-black text-white">
                  {step.step}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      {!!cms?.features?.length && (
        <section className="bg-brand py-16">
          <div className="container-page">
            <div className="text-center text-white">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest">
                Why {brandName}
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight">
                Everything you need to succeed
              </h2>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {cms.features.map((f) => (
                <div key={f.id} className="rounded-2xl border border-white/20 bg-white/10 p-7 text-white backdrop-blur-sm">
                  {f.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.icon} alt="" className="h-12 w-12 object-contain" />
                  )}
                  <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm text-white/70">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {!!cms?.testimonials?.length && (
        <section className="bg-surface py-16">
          <div className="container-page">
            <div className="text-center">
              <span className="badge">Reviews</span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">What our students say</h2>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {cms.testimonials.map((t) => (
                <div key={t.id} className="card flex flex-col p-7">
                  <Stars rating={t.rating ?? 5} />
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">"{t.comment}"</p>
                  <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                    {t.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.image} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft font-bold text-brand">
                        {t.name[0]}
                      </span>
                    )}
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      {t.headline && <div className="text-xs text-muted">{t.headline}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container-page py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand to-accent p-10 text-white sm:p-16">
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/5" aria-hidden />

          <div className="relative max-w-xl">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Start teaching on {brandName}</h2>
            <p className="mt-3 text-lg text-white/80">
              Share your expertise with learners worldwide. Earn revenue from every enrollment and build your audience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/become-instructor" className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-brand shadow-lg transition hover:bg-white/90">
                Become an instructor
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link href="/courses" className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/20">
                Browse courses
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
