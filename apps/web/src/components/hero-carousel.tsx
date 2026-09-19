'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Free-to-use Unsplash photos — no attribution required (unsplash.com/license).
const SLIDES = [
  {
    src: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=1600&q=80&auto=format&fit=crop',
    badge: '🎓 200,000+ students learning today',
  },
  {
    src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&q=80&auto=format&fit=crop',
    badge: '👩‍💻 Expert instructors from top companies',
  },
  {
    src: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&q=80&auto=format&fit=crop',
    badge: '📜 Earn verified certificates',
  },
];
const AUTO_ADVANCE_MS = 5500;

interface HeroProps {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}

export function HeroCarousel({ title, subtitle, primaryHref, primaryLabel, secondaryHref, secondaryLabel }: HeroProps) {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), AUTO_ADVANCE_MS);
  };

  useEffect(() => {
    start();
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (i: number) => { setIndex(i); start(); };

  return (
    <section className="relative isolate min-h-[560px] overflow-hidden bg-ink text-white lg:min-h-[640px]">
      {/* Background images */}
      {SLIDES.map(({ src }, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            i === index ? 'opacity-40' : 'opacity-0'
          }`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/75 to-ink/30" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" aria-hidden />

      <div className="container-page relative flex flex-col justify-center py-20 lg:py-28">
        {/* Sliding badge */}
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            {SLIDES[index].badge}
          </span>
        </div>

        <h1 className="max-w-2xl text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
          {subtitle}
        </p>

        {/* CTA buttons */}
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110 active:scale-[0.98]"
          >
            {primaryLabel}
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            {secondaryLabel}
          </Link>
        </div>

        {/* Trust indicators */}
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/60">
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
            Lifetime access
          </span>
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
            Certificate on completion
          </span>
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
            Learn at your own pace
          </span>
        </div>
      </div>

      {/* Dot navigation */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`rounded-full transition-all ${
              i === index ? 'h-2 w-8 bg-brand' : 'h-2 w-2 bg-white/30 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
