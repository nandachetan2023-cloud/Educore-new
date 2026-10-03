'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Award, BadgeCheck, BookOpen, CheckCircle2, Clock, Megaphone, Play, Search, Star, Tag, Users, Zap,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useBranding } from '@/lib/providers';
import { CourseCard } from '@/components/course-card';
import { CategoryIcon, Stars } from '@/components/ui';
import type { CourseCard as Course, Category, Paginated, HomeCms, StorefrontOffer } from '@/lib/types';

const HERO_IMG = 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200&q=80&auto=format&fit=crop';

const WORDMARKS = ['TECHGIANT', 'CREATIVE-X', 'GLOBAL-EDU', 'FUTURE-TECH', 'INNOVATE'];

const DEFAULT_PERKS = [
  { icon: Users, tint: 'bg-blue-500/10 text-brand', title: 'Expert Community', desc: 'Connect with thousands of students and share knowledge in real-time.' },
  { icon: Clock, tint: 'bg-green-500/10 text-green-600', title: 'Lifetime Access', desc: "Learn at your own pace. Once you buy, it's yours forever." },
  { icon: BookOpen, tint: 'bg-slate-500/10 text-slate-600', title: 'Quality Resources', desc: 'Downloadable assets, source code, and project files included.' },
  { icon: Award, tint: 'bg-rose-500/10 text-rose-500', title: 'Certification', desc: 'Earn industry-recognized certificates for every completed path.' },
];

const CHECKLIST = [
  'Watch on any device: Laptop, Tablet, or Mobile',
  'Offline viewing enabled on mobile apps',
  'Interactive quizzes and coding exercises',
  'Direct communication with expert instructors',
];

export default function HomePage() {
  const branding = useBranding();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cms, setCms] = useState<HomeCms | null>(null);
  const [offers, setOffers] = useState<StorefrontOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroQuery, setHeroQuery] = useState('');

  useEffect(() => {
    Promise.all([
      api<Paginated<Course>>('/courses?perPage=6', { auth: false }).catch(() => null),
      api<Category[]>('/categories', { auth: false }).catch(() => []),
      api<HomeCms>('/cms/home', { auth: false }).catch(() => null),
      api<StorefrontOffer[]>('/coupons/offers', { auth: false }).catch(() => []),
    ]).then(([c, cats, home, liveOffers]) => {
      if (c) setCourses(c.data);
      setCategories(cats ?? []);
      setCms(home);
      setOffers(liveOffers ?? []);
      setLoading(false);
    });
  }, []);

  const brandName = branding?.name ?? 'EduCore';
  const featured = courses.slice(0, 3);
  const topCategories = categories.slice(0, 8);
  const testimonials = (cms?.testimonials?.length ? cms.testimonials : []).slice(0, 3);

  const submitHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(heroQuery.trim() ? `/courses?search=${encodeURIComponent(heroQuery.trim())}` : '/courses');
  };

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="overflow-hidden bg-gradient-to-b from-brand-soft/60 via-card to-surface">
        <div className="container-page grid items-center gap-12 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="section-pill"><Zap className="mr-1.5 h-3.5 w-3.5" /> Unlock your potential</span>
            <h1 className="mt-5 font-display text-[42px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
              Master New Skills with the{' '}
              <em className="text-brand">Best in Class</em> Experts.
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
              Access over 5,000+ world-class courses designed by industry leaders to help you advance your
              career and achieve your personal goals.
            </p>

            <form onSubmit={submitHeroSearch} className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row">
              <label className="relative flex flex-1 items-center">
                <Search className="absolute left-4 h-4 w-4 text-muted" />
                <input
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="What do you want to learn?"
                  className="w-full rounded-full border border-line bg-card py-3.5 pl-11 pr-4 text-sm text-ink shadow-sm placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <button type="submit" className="btn-primary rounded-full px-8 py-3.5 text-[15px]">
                Explore Now
              </button>
            </form>

            <div className="mt-9 flex items-center gap-6 sm:gap-8">
              <div>
                <div className="text-2xl font-extrabold text-ink">15k+</div>
                <div className="mt-0.5 text-[13px] text-muted">Active Students</div>
              </div>
              <div className="h-10 w-px bg-line" />
              <div>
                <div className="text-2xl font-extrabold text-ink">1.2k+</div>
                <div className="mt-0.5 text-[13px] text-muted">Expert Tutors</div>
              </div>
              <div className="h-10 w-px bg-line" />
              <div>
                <div className="text-2xl font-extrabold text-ink">4.8/5</div>
                <div className="mt-0.5 text-[13px] text-muted">User Rating</div>
              </div>
            </div>
          </div>

          {/* Hero visual with floating cards */}
          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="overflow-hidden rounded-[28px] shadow-lift">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_IMG} alt="Students learning together" className="aspect-[4/4.4] w-full object-cover sm:aspect-[4/3.6]" />
            </div>
            <div className="absolute -left-3 top-8 flex items-center gap-2.5 rounded-2xl border border-line bg-card px-4 py-3 shadow-lift sm:-left-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-green-500/10 text-green-600">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Certified</span>
                <span className="block text-sm font-bold text-ink">Course Completion</span>
              </span>
            </div>
            <div className="absolute -right-2 bottom-10 flex items-center gap-2.5 rounded-2xl border border-line bg-card px-4 py-3 shadow-lift sm:-right-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Play className="h-5 w-5 fill-current" />
              </span>
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Live now</span>
                <span className="block text-sm font-bold text-ink">UI Design Masterclass</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live offers ─────────────────────────────────── */}
      {offers.length > 0 && (
        <section className="border-b border-line bg-card py-12 lg:py-14">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <span className="section-pill !border-rose-500/25 !bg-rose-500/10 !text-rose-600">
                  <Megaphone className="mr-1.5 h-3.5 w-3.5" /> Limited time
                </span>
                <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
                  On sale right now
                </h2>
                <p className="mt-3 text-muted">
                  These prices are already discounted — no code needed at checkout.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-sm"
                >
                  {offer.banner && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={offer.banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
                  )}
                  <div className="relative">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-600">
                        <Tag className="h-3 w-3" /> {offer.badge || offer.valueLabel}
                      </span>
                      {offer.endsAt && (
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                          Ends {new Date(offer.endsAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-xl font-extrabold text-ink">{offer.title}</h3>
                    {offer.subtitle && <p className="mt-1 text-sm text-muted">{offer.subtitle}</p>}

                    {offer.courses.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {offer.courses.slice(0, 3).map((c) => (
                          <li key={c.id}>
                            <Link
                              href={`/courses/${c.slug}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-2.5 text-sm transition hover:shadow-sm"
                            >
                              <span className="truncate font-semibold text-ink">{c.title}</span>
                              <span className="shrink-0 text-xs font-bold text-rose-600">{offer.valueLabel}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Link
                      href="/courses"
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                    >
                      Shop the sale <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Logo strip ───────────────────────────────────── */}      <section className="border-y border-line bg-card py-7">
        <div className="container-page flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {cms?.brands?.length ? (
            cms.brands.slice(0, 6).map((b) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={b.id} src={b.image} alt="" className="h-6 w-auto object-contain opacity-50 grayscale" />
            ))
          ) : (
            WORDMARKS.map((w) => (
              <span key={w} className="font-display text-xl font-bold tracking-wide text-ink/30">{w}</span>
            ))
          )}
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────── */}
      {topCategories.length > 0 && (
        <section id="categories" className="container-page py-16 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="section-pill">Browse by category</span>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Top Skills to Master
              </h2>
              <p className="mt-3 text-muted">
                Choose from a wide variety of subjects and start learning today. Each category contains
                carefully curated content from world-class instructors.
              </p>
            </div>
            <Link href="/courses" className="btn-ghost rounded-full text-sm">
              View All Categories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {topCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/courses?category=${cat.slug}`}
                className="group rounded-2xl border border-line bg-card p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lift"
              >
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface text-ink transition group-hover:bg-brand group-hover:text-white">
                  <CategoryIcon name={cat.name} className="h-6 w-6" />
                </span>
                <span className="mt-4 block text-[17px] font-bold text-ink group-hover:text-brand">{cat.name}</span>
                <span className="mt-1 block text-[13px] text-muted">{cat._count?.courses ?? 0} courses</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Featured courses ─────────────────────────────── */}
      <section className="bg-surface py-16 lg:py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="section-pill !border-green-500/25 !bg-green-500/10 !text-green-600">Recommended for you</span>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Featured Professional Courses
              </h2>
              <p className="mt-3 text-muted">
                Boost your career with our top-selling courses this month. Selected by our editorial team
                for quality and market relevance.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/courses" aria-label="Previous" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-ink transition hover:border-brand hover:text-brand">
                <ArrowRight className="h-4 w-4 rotate-180" />
              </Link>
              <Link href="/courses" aria-label="Next" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-ink transition hover:border-brand hover:text-brand">
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-line/40" />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-line bg-card py-20 text-center text-muted">
              No published courses yet. Check back soon!
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((c, i) => (
                <CourseCard key={c.id} course={c} badge={i === 0 ? 'Bestseller' : i === 1 ? 'Highest Rated' : 'New'} />
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link href="/courses" className="btn-primary rounded-full px-10 py-3.5 text-[15px]">
              Browse Discovery Feed
            </Link>
          </div>
        </div>
      </section>

      {/* ── Perks + adaptive learning ────────────────────── */}
      <section className="container-page grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div className="grid grid-cols-2 gap-4">
          {DEFAULT_PERKS.map((p, i) => (
            <div key={p.title} className={`rounded-2xl p-6 ${i % 2 === 1 ? 'mt-8' : ''} ${i === 0 ? 'bg-blue-500/[0.06]' : i === 1 ? 'bg-green-500/[0.07]' : i === 2 ? 'bg-slate-500/[0.07]' : 'bg-rose-500/[0.06]'}`}>
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${p.tint}`}>
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[15px] font-bold text-ink">{p.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{p.desc}</p>
            </div>
          ))}
        </div>
        <div>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">
            Learning That Truly Adapts to Your Lifestyle
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            Whether you're looking to jumpstart a new career, level up in your current role, or simply
            explore a passion, our platform provides the tools and flexibility you need.
          </p>
          <ul className="mt-6 space-y-3.5">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] font-medium text-ink">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                {item}
              </li>
            ))}
          </ul>
          <Link href="/register" className="btn-primary mt-8 rounded-full px-8 py-3.5 text-[15px]">
            Get Started for Free
          </Link>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section className="bg-surface py-16 lg:py-20">
          <div className="container-page text-center">
            <span className="section-pill">Voices of success</span>
            <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Loved by Thousands of Learners
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted">
              Join a global community of over 1.5 million learners who are achieving their goals through
              the {brandName} platform.
            </p>
            <div className="mt-10 grid gap-6 text-left sm:grid-cols-3">
              {testimonials.map((t) => (
                <div key={t.id} className="flex flex-col rounded-2xl border border-line bg-card p-7 shadow-sm">
                  <div className="flex items-center gap-3">
                    {t.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.image} alt={t.name} className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft font-bold text-brand">
                        {t.name[0]}
                      </span>
                    )}
                    <div>
                      <div className="text-sm font-bold text-ink">{t.name}</div>
                      {t.headline && <div className="text-xs text-muted">{t.headline}</div>}
                    </div>
                  </div>
                  <p className="mt-4 flex-1 text-[15px] italic leading-relaxed text-ink/70">"{t.comment}"</p>
                  <div className="mt-5 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < (t.rating ?? 5) ? 'fill-green-500 text-green-500' : 'fill-line text-line'}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA banner ───────────────────────────────────── */}
      <section className="container-page py-16 lg:py-20">
        <div className="relative overflow-hidden rounded-[28px] bg-brand px-6 py-14 text-center text-white sm:px-16 sm:py-16">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10" aria-hidden />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-black/10" aria-hidden />
          <h2 className="relative mx-auto max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
            Ready to start your learning journey?
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-white/75">
            Join {brandName} today and get 20% off your first professional certification course.
            Offer valid for new students only.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="rounded-full bg-green-500 px-8 py-3.5 text-[15px] font-bold text-white shadow-lg transition hover:brightness-110">
              Create Free Account
            </Link>
            <Link href="/page/about" className="rounded-full border border-white/40 bg-white/10 px-8 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/20">
              Learn more about us
            </Link>
          </div>
          <p className="relative mt-5 text-[13px] text-white/60">
            No credit card required to get started. 30-day money-back guarantee on all courses.
          </p>
        </div>
      </section>
    </>
  );
}
