'use client';

import Link from 'next/link';
import { useBranding } from '@/lib/providers';
import { priceLabel, type CourseCard as Course } from '@/lib/types';

function StarRating({ rating = 4.5, count = 0 }: { rating?: number; count?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-bold text-amber-500">{rating.toFixed(1)}</span>
      <div className="flex gap-px">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < full;
          const isHalf = !filled && i === full && half;
          return (
            <svg key={i} viewBox="0 0 20 20" className="h-3 w-3 text-amber-400" fill={filled ? 'currentColor' : isHalf ? 'url(#half)' : 'none'} stroke="currentColor" strokeWidth={1.5}>
              {isHalf && (
                <defs>
                  <linearGradient id="half">
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              )}
              <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.8L10 14.9l-5.21 2.74 1-5.8-4.21-4.1 5.82-.85z" strokeLinejoin="round" />
            </svg>
          );
        })}
      </div>
      {count > 0 && <span className="text-xs text-muted">({count.toLocaleString()})</span>}
    </div>
  );
}

export function CourseCard({ course, featured }: { course: Course; featured?: boolean }) {
  const branding = useBranding();
  const currency = branding?.currency ?? 'USD';
  const hasDiscount = (course.discount ?? 0) > 0;
  const isBestseller = (course._count.enrollments ?? 0) > 50;
  const rating = course.averageRating ?? 4.5;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="card group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-brand-soft">
        {course.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand/10 to-accent/10 text-4xl font-black text-brand/30">
            {course.title[0]}
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute left-3 top-3 flex gap-2">
          {isBestseller && (
            <span className="rounded-sm bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
              Bestseller
            </span>
          )}
          {course.category && (
            <span className="rounded-sm bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-ink shadow">
              {course.category.name}
            </span>
          )}
        </div>
        {hasDiscount && (
          <div className="absolute right-3 top-3 rounded-sm bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            -{course.discount}%
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover:text-brand">
          {course.title}
        </h3>
        <p className="mt-1 text-xs text-muted">{course.instructor.name}</p>

        <div className="mt-2">
          <StarRating rating={rating} count={course._count.enrollments} />
        </div>

        {featured && course._count.enrollments > 0 && (
          <p className="mt-1 text-xs text-muted">{course._count.enrollments.toLocaleString()} students</p>
        )}

        <div className="mt-auto flex items-end justify-between border-t border-line pt-3 pt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-ink">{priceLabel(course, currency)}</span>
            {hasDiscount && (
              <span className="text-xs text-muted line-through">
                {new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(course.price ?? 0)}
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-brand opacity-0 transition group-hover:opacity-100">
            Enroll →
          </span>
        </div>
      </div>
    </Link>
  );
}
