'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useBranding } from '@/lib/providers';
import { priceLabel, type CourseCard as Course } from '@/lib/types';
import { CourseThumb, Stars } from '@/components/ui';

export function CourseCard({ course, badge }: { course: Course; badge?: 'Bestseller' | 'Highest Rated' | 'New' }) {
  const branding = useBranding();
  const currency = branding?.currency ?? 'USD';
  const hasDiscount = (course.discount ?? 0) > 0;
  const enrollments = course._count.enrollments ?? 0;
  const computed: typeof badge =
    badge ?? (enrollments > 50 ? 'Bestseller' : (course.averageRating ?? 0) >= 4.8 ? 'Highest Rated' : undefined);
  const rating = course.averageRating ?? 4.5;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] overflow-hidden bg-surface">
        <CourseThumb
          src={course.thumbnail}
          seed={course.id}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {computed && (
          <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white shadow">
            {computed}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
          {course.category && (
            <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-green-600">{course.category.name}</span>
          )}
          {course.duration && (
            <span className="font-medium normal-case tracking-normal text-muted">◷ {course.duration}</span>
          )}
        </div>

        <h3 className="mt-2.5 line-clamp-2 text-[17px] font-bold leading-snug text-ink group-hover:text-brand">
          {course.title}
        </h3>
        <p className="mt-1 text-sm text-muted">{course.instructor.name}</p>

        <div className="mt-2">
          <Stars rating={rating} count={enrollments} />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-ink">{priceLabel(course, currency)}</span>
            {hasDiscount && (
              <span className="text-sm text-muted line-through">
                {new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(course.price ?? 0)}
              </span>
            )}
          </div>
          <span className="grid h-8 w-8 place-items-center rounded-full text-brand transition group-hover:bg-brand group-hover:text-white">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
