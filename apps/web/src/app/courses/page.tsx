'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { CourseCard } from '@/components/course-card';
import type { CourseCard as Course, Category, Paginated } from '@/lib/types';

function CatalogInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<Paginated<Course> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const page = Number(params.get('page') ?? 1);

  useEffect(() => {
    api<Category[]>('/categories', { auth: false }).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    if (sort) qs.set('sort', sort);
    qs.set('page', String(page));
    api<Paginated<Course>>(`/courses?${qs.toString()}`, { auth: false })
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [search, category, sort, page]);

  const update = (key: string, value: string) => {
    const qs = new URLSearchParams(params.toString());
    if (value) qs.set(key, value);
    else qs.delete(key);
    if (key !== 'page') qs.delete('page');
    router.push(`/courses?${qs.toString()}`);
  };

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-extrabold">All courses</h1>
      <p className="mt-2 text-muted">{result?.meta.total ?? 0} courses available</p>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          defaultValue={search}
          placeholder="Search courses…"
          className="input sm:max-w-sm"
          onKeyDown={(e) => e.key === 'Enter' && update('search', (e.target as HTMLInputElement).value)}
        />
        <select className="input sm:max-w-xs" value={category} onChange={(e) => update('category', e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select className="input sm:max-w-[12rem]" value={sort} onChange={(e) => update('sort', e.target.value)}>
          <option value="newest">Newest</option>
          <option value="price_low">Price: low to high</option>
          <option value="price_high">Price: high to low</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card aspect-[3/4] animate-pulse bg-line/30" />
          ))}
        </div>
      ) : !result || result.data.length === 0 ? (
        <div className="card mt-8 p-16 text-center text-muted">No courses match your filters.</div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.data.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
          {result.meta.lastPage > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <button
                className="btn-ghost"
                disabled={page <= 1}
                onClick={() => update('page', String(page - 1))}
              >
                ← Prev
              </button>
              <span className="px-3 text-sm text-muted">
                Page {page} of {result.meta.lastPage}
              </span>
              <button
                className="btn-ghost"
                disabled={page >= result.meta.lastPage}
                onClick={() => update('page', String(page + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<div className="container-page py-10">Loading…</div>}>
      <CatalogInner />
    </Suspense>
  );
}
