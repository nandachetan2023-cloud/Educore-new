'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  Megaphone,
  MonitorPlay,
  PenLine,
  Star,
  UploadCloud,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useBranding, useAuth } from '@/lib/providers';
import type { HomeCms } from '@/lib/types';

const STEPS = [
  {
    icon: PenLine,
    title: '1. Create your account',
    body: 'Register as an instructor in under two minutes. Tell us who you are and what you teach — no upfront fees, no application queue.',
  },
  {
    icon: MonitorPlay,
    title: '2. Build your course',
    body: 'Use the course builder to add chapters and lessons, upload videos or embed from YouTube and Vimeo, attach downloadable resources, and set your price.',
  },
  {
    icon: ClipboardCheck,
    title: '3. Get reviewed & published',
    body: 'Submit for review. We check quality, structure, and originality — most courses are approved quickly — then your course goes live in the catalog.',
  },
  {
    icon: BadgeDollarSign,
    title: '4. Earn on every enrollment',
    body: 'Every sale credits your wallet automatically. Request a payout whenever you like and track students, revenue, and reviews from your dashboard.',
  },
];

const TOOLKIT = [
  {
    icon: BookOpen,
    title: 'Visual course builder',
    body: 'Organize chapters and lessons with drag-and-drop ordering, preview lessons, and rich descriptions.',
  },
  {
    icon: UploadCloud,
    title: 'Flexible video options',
    body: 'Upload video files directly or embed from YouTube, Vimeo, or external links — whatever fits your workflow.',
  },
  {
    icon: Wallet,
    title: 'Wallet & payouts',
    body: 'Revenue lands in your wallet on every enrollment. Withdraw anytime through your chosen payout method.',
  },
  {
    icon: Users,
    title: 'Student insights',
    body: 'See enrollments, lesson completion, and ratings per course so you know exactly what is working.',
  },
  {
    icon: Star,
    title: 'Reviews that sell',
    body: 'Verified student reviews build trust and push your course up the catalog — quality compounds.',
  },
  {
    icon: GraduationCap,
    title: 'Certificates for students',
    body: 'Learners earn a certificate on completion, which makes your course more valuable — and more bought.',
  },
];

const REQUIREMENTS = [
  'Original content you created or have the rights to teach',
  'Clear audio and readable video — a phone and quiet room is enough to start',
  'A logical structure: chapters that build on each other toward a real outcome',
  'At least a few lessons with genuine depth — no filler, no upsells inside lessons',
  'Accurate titles and descriptions so students know exactly what they will learn',
];

const FAQS = [
  {
    q: 'Do I need to be a famous expert to teach?',
    a: 'No. You need real, demonstrable skill in your topic and the ability to explain it clearly. Many top-earning instructors started as practitioners sharing what they use at work every day.',
  },
  {
    q: 'How and when do I get paid?',
    a: 'Each enrollment credits your instructor wallet automatically after checkout. You can request a payout at any time from your dashboard, and requests are reviewed and processed by the platform team.',
  },
  {
    q: 'Who owns my course content?',
    a: 'You do — always. You grant the platform a license to sell and deliver your course to enrolled students. You can unpublish or update your course whenever you want.',
  },
  {
    q: 'What does the review check?',
    a: 'Reviewers verify that the course is original, well-structured, and matches its title and description, with acceptable audio/video quality. It is a quality bar, not a gatekeeping exercise — most well-prepared courses pass on the first submission.',
  },
  {
    q: 'Can I price my own course — including free?',
    a: 'Yes. You set the price and optional discount. Free courses are a great way to build an audience and collect reviews before launching a paid course.',
  },
  {
    q: 'What does it cost to start teaching?',
    a: 'Nothing. Creating an account, building courses, and publishing are all free. The platform only earns when you earn, through a commission on each sale.',
  },
];

export default function BecomeInstructorPage() {
  const branding = useBranding();
  const { user } = useAuth();
  const [counters, setCounters] = useState<{ title: string; number: string }[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    api<HomeCms>('/cms/home', { auth: false })
      .then((cms) => {
        if (cms?.counters?.length) setCounters(cms.counters.slice(0, 4));
      })
      .catch(() => {});
  }, []);

  const brandName = branding?.name ?? 'EduCore';
  const commission = branding?.commissionRate ?? 20;
  const instructorShare = Math.max(0, 100 - commission);
  const isInstructor = user?.principal === 'instructor';

  const primaryCta = isInstructor ? (
    <Link href="/dashboard/instructor" className="rounded-full bg-green-500 px-8 py-3.5 text-[15px] font-bold text-white shadow-lg transition hover:brightness-110">
      Go to instructor dashboard
    </Link>
  ) : (
    <Link href="/register" className="rounded-full bg-green-500 px-8 py-3.5 text-[15px] font-bold text-white shadow-lg transition hover:brightness-110">
      Start teaching today
    </Link>
  );

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="overflow-hidden bg-gradient-to-b from-brand-soft/60 via-card to-surface">
        <div className="container-page grid items-center gap-12 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="section-pill">
              <Megaphone className="mr-1.5 h-3.5 w-3.5" /> For instructors
            </span>
            <h1 className="mt-5 font-display text-[42px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
              Turn what you know into <em className="text-brand">income</em>.
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
              Teach on {brandName} and reach motivated learners around the world. Build your course
              once, keep up to <strong className="text-ink">{instructorShare}% of every sale</strong>,
              and get paid while you sleep — no upfront costs, ever.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryCta}
              <Link href="/courses" className="rounded-full border border-line bg-card px-8 py-3.5 text-[15px] font-bold text-ink transition hover:border-brand/40 hover:text-brand">
                Explore the catalog
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-muted">
              Free to join · You own your content · 30-day money-back guarantee makes students buy with confidence
            </p>
          </div>

          {/* Earnings card */}
          <div className="mx-auto w-full max-w-[480px]">
            <div className="card overflow-hidden p-8 shadow-lift">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Wallet className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wider text-muted">Your share</div>
                  <div className="font-display text-4xl font-semibold text-ink">{instructorShare}% <span className="text-base font-normal text-muted">of every sale</span></div>
                </div>
              </div>
              <div className="mt-6 h-3 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-brand" style={{ width: `${instructorShare}%` }} />
              </div>
              <ul className="mt-6 space-y-3 text-[15px]">
                {[
                  `You keep ${instructorShare}% — platform fee is just ${commission}%`,
                  'Revenue credited to your wallet on every enrollment',
                  'Request payouts anytime from your dashboard',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-ink/80">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" /> {line}
                  </li>
                ))}
              </ul>
            </div>
            {counters.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {counters.map((c) => (
                  <div key={c.title} className="card px-4 py-3 text-center">
                    <div className="text-lg font-extrabold text-ink">{c.number}</div>
                    <div className="mt-0.5 text-[11px] leading-tight text-muted">{c.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="container-page py-16 lg:py-20">
        <div className="text-center">
          <span className="section-pill">How it works</span>
          <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            From expertise to income in four steps
          </h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.title} className="card p-6">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Toolkit ──────────────────────────────────────── */}
      <section className="bg-surface py-16 lg:py-20">
        <div className="container-page">
          <div className="text-center">
            <span className="section-pill">Everything included</span>
            <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Everything you need to teach, built in
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted">
              No third-party tools, no plugins, no tech headaches — the {brandName} instructor
              dashboard handles the whole journey from first lesson to payday.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLKIT.map((t) => (
              <div key={t.title} className="card p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <t.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold text-ink">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Requirements ─────────────────────────────────── */}
      <section className="container-page py-16 lg:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <span className="section-pill">Quality bar</span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              What makes a course get approved?
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              Review is fast and friendly — it exists to protect students and to protect the value
              of <em>your</em> course. If you meet these five criteria, you will almost certainly
              pass on the first submission.
            </p>
            <div className="mt-6">{primaryCta}</div>
          </div>
          <ul className="card divide-y divide-line overflow-hidden">
            {REQUIREMENTS.map((r, i) => (
              <li key={r} className="flex items-start gap-3 p-5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green-500/15 text-sm font-bold text-green-600">
                  {i + 1}
                </span>
                <span className="text-[15px] text-ink/85">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="bg-surface py-16 lg:py-20">
        <div className="container-page max-w-3xl">
          <div className="text-center">
            <span className="section-pill">Questions, answered</span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Instructor FAQ
            </h2>
          </div>
          <div className="mt-8 space-y-3">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} className="card overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  >
                    <span className="font-bold text-ink">{f.q}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted">{f.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="container-page py-16 lg:py-20">
        <div className="relative overflow-hidden rounded-[28px] bg-brand px-6 py-14 text-center text-white sm:px-16 sm:py-16">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10" aria-hidden />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-black/10" aria-hidden />
          <h2 className="relative mx-auto max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
            Your knowledge is worth teaching.
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-white/75">
            Join {brandName} today, publish your first course this week, and earn {instructorShare}%
            on every enrollment. Still unsure? Read how it works on the{' '}
            <Link href="/page/about" className="font-semibold text-white underline underline-offset-2">about page</Link>{' '}
            or <Link href="/contact" className="font-semibold text-white underline underline-offset-2">talk to us</Link>.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            {primaryCta}
            <Link href="/contact" className="rounded-full border border-white/40 bg-white/10 px-8 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/20">
              Contact us
            </Link>
          </div>
          <p className="relative mt-5 text-[13px] text-white/60">
            Free to start · No credit card required · You keep ownership of your content
          </p>
        </div>
      </section>
    </>
  );
}
