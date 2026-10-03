'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, BookOpen, LayoutGrid, List, RotateCcw, Search, SlidersHorizontal, Star, TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CourseCard } from '@/components/course-card';
import { CategoryIcon } from '@/components/ui';
import type { CourseCard as Course, Category, Paginated } from '@/lib/types';

interface Level { id: number; name: string; slug: string }

const PER_PAGE = 9;
const MAX_PRICE = 500;

function netPrice(c: Course): number {
  return Math.max(0, (c.price ?? 0) - (c.discount ?? 0));
}

function CatalogInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const level = params.get('level') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const [query, setQuery] = useState(search);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [minRating, setMinRating] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    api<Category[]>('/categories', { auth: false }).then(setCategories).catch(() => {});
    api<Level[]>('/levels', { auth: false }).then(setLevels).catch(() => []);
  }, []);

  useEffect(() => { setQuery(search); }, [search]);

  // Reset client filters + pagination whenever server filters change.
  useEffect(() => {
    setPage(1);
    setMaxPrice(MAX_PRICE);
    setMinRating(0);
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    if (level) qs.set('level', level);
    if (sort) qs.set('sort', sort);
    qs.set('page', '1');
    qs.set('perPage', String(PER_PAGE));
    api<Paginated<Course>>(`/courses?${qs.toString()}`, { auth: false })
      .then((r) => { setItems(r.data); setTotal(r.meta.total); setLastPage(r.meta.lastPage); })
      .catch(() => { setItems([]); setTotal(0); setLastPage(1); })
      .finally(() => setLoading(false));
  }, [search, category, level, sort]);

  const loadMore = () => {
    if (page >= lastPage) return;
    const next = page + 1;
    setLoadingMore(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    if (level) qs.set('level', level);
    if (sort) qs.set('sort', sort);
    qs.set('page', String(next));
    qs.set('perPage', String(PER_PAGE));
    api<Paginated<Course>>(`/courses?${qs.toString()}`, { auth: false })
      .then((r) => { setItems((prev) => [...prev, ...r.data]); setPage(next); })
      .finally(() => setLoadingMore(false));
  };

  const update = (key: string, value: string) => {
    const qs = new URLSearchParams(params.toString());
    if (value) qs.set(key, value);
    else qs.delete(key);
    router.push(`/courses?${qs.toString()}`);
  };

  const resetAll = () => {
    setMaxPrice(MAX_PRICE);
    setMinRating(0);
    router.push('/courses');
  };

  const hasActiveFilters = !!(search || category || level || maxPrice < MAX_PRICE || minRating > 0);

  // Price + rating have no server-side support, so they filter the loaded page client-side.
  const visible = useMemo(
    () => items.filter((c) => netPrice(c) <= maxPrice && (c.averageRating ?? 0) >= minRating),
    [items, maxPrice, minRating],
  );

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    update('search', query.trim());
  };

  return (
    <div className="bg-surface">
      <div className="container-page py-10">
        {/* Heading + stat chips */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-[44px]">
              Discover Your Next Skill
            </h1>
            <p className="mt-3 text-muted">
              Browse through over 25,000+ premium courses taught by industry experts and academic professors.
            </p>
          </div>
          <div className="flex items-center gap-6 rounded-2xl border border-line bg-card px-6 py-4 shadow-sm">
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted">Courses</div>
              <div className="text-xl font-extrabold text-brand">{total > 0 ? `${(total / 1000).toFixed(1)}k+` : '25k+'}</div>
            </div>
            <div className="h-10 w-px bg-line" />
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted">Learners</div>
              <div className="text-xl font-extrabold text-brand">1.2M</div>
            </div>
            <div className="h-10 w-px bg-line" />
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted">Expertise</div>
              <div className="mt-1 flex -space-x-2">
                {[11, 22, 33].map((s) => (
                  <img key={s} src={`https://picsum.photos/seed/mentor-${s}/48/48`} alt="" className="h-7 w-7 rounded-full border-2 border-card object-cover" />
                ))}
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-brand text-[9px] font-bold text-white">+4k</span>
              </div>
            </div>
          </div>
        </div>

        {/* Big search */}
        <form onSubmit={submitSearch} className="mt-8 max-w-3xl">
          <label className="relative flex items-center">
            <Search className="absolute left-5 h-5 w-5 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What do you want to learn today? Try 'React Development' or 'UI Design'..."
              className="w-full rounded-full border border-line bg-card py-4 pr-5 text-[15px] text-ink shadow-sm placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              style={{ paddingLeft: '3.25rem' }}
            />
          </label>
        </form>

        <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* ── Filters sidebar ── */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <SlidersHorizontal className="h-4 w-4 text-brand" /> Filters
              </h2>
              {hasActiveFilters && (
                <button onClick={resetAll} className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-brand">
                  <RotateCcw className="h-3 w-3" /> Reset All
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="mt-5 border-t border-line pt-5">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink">Categories</h3>
              <div className="mt-3 space-y-2.5">
                {categories.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink/80 hover:text-ink">
                    <input
                      type="checkbox"
                      checked={category === c.slug}
                      onChange={() => update('category', category === c.slug ? '' : c.slug)}
                      className="h-4 w-4 rounded border-line accent-brand"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

            {/* Level */}
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink">Level</h3>
              <div className="mt-3 space-y-2.5">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink/80">
                  <input type="checkbox" checked={!level} onChange={() => update('level', '')} className="h-4 w-4 rounded border-line accent-brand" />
                  All Levels
                </label>
                {(levels.length ? levels : [{ id: -1, name: 'Beginner', slug: 'beginner' }, { id: -2, name: 'Intermediate', slug: 'intermediate' }, { id: -3, name: 'Advanced', slug: 'advanced' }]).map((l) => (
                  <label key={l.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink/80">
                    <input
                      type="checkbox"
                      checked={level === l.slug}
                      onChange={() => update('level', level === l.slug ? '' : l.slug)}
                      className="h-4 w-4 rounded border-line accent-brand"
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink">Price range</h3>
              <input
                type="range" min={0} max={MAX_PRICE} step={10} value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="mt-4 w-full accent-brand"
              />
              <div className="mt-2 flex items-center justify-between text-[13px]">
                <span className="rounded-lg border border-line bg-card px-3 py-1.5 font-semibold">$0</span>
                <span className="text-muted">—</span>
                <span className="rounded-lg border border-line bg-card px-3 py-1.5 font-semibold">${maxPrice}</span>
              </div>
            </div>

            {/* Ratings */}
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink">Ratings</h3>
              <div className="mt-3 space-y-2.5">
                {[4, 3, 2].map((r) => (
                  <button
                    key={r}
                    onClick={() => setMinRating(minRating === r ? 0 : r)}
                    className={`flex items-center gap-1.5 text-sm ${minRating === r ? 'font-bold text-ink' : 'text-muted hover:text-ink'}`}
                  >
                    <span className="flex gap-px">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r ? 'fill-brand text-brand' : 'fill-line text-line'}`} />
                      ))}
                    </span>
                    & up
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Results ── */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <p className="text-[15px] font-bold text-ink">Showing {visible.length} results</p>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-muted">SORT BY:</span>
                <select value={sort} onChange={(e) => update('sort', e.target.value)} className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink focus:border-brand focus:outline-none">
                  <option value="newest">Popularity</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                </select>
                <div className="flex rounded-full border border-line bg-card p-1">
                  <button aria-label="Grid view" onClick={() => setView('grid')} className={`grid h-8 w-8 place-items-center rounded-full ${view === 'grid' ? 'bg-green-500 text-white' : 'text-muted'}`}>
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button aria-label="List view" onClick={() => setView('list')} className={`grid h-8 w-8 place-items-center rounded-full ${view === 'list' ? 'bg-green-500 text-white' : 'text-muted'}`}>
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-line/40" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line bg-card p-16 text-center text-muted">
                No courses match your filters.
              </div>
            ) : view === 'grid' ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {visible.slice(0, 3).map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
                {/* Promo card inside the grid */}
                <div className="flex flex-col items-center justify-center rounded-2xl bg-brand p-8 text-center text-white shadow-lift">
                  <TrendingUp className="h-8 w-8" />
                  <h3 className="mt-4 text-xl font-bold">Professional Skills Path</h3>
                  <p className="mt-2 text-sm text-white/75">Get personalized learning paths tailored for your career goals.</p>
                  <Link href="/courses" className="mt-6 flex items-center gap-2 rounded-full bg-green-500 px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110">
                    Take Career Quiz <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                {visible.slice(3).map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {visible.map((c) => (
                  <Link key={c.id} href={`/courses/${c.slug}`} className="group flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:shadow-lift sm:flex-row">
                    <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl sm:w-56">
                      <img src={c.thumbnail || `https://picsum.photos/seed/educore-${c.id}/640/360`} alt={c.title} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col py-1">
                      <h3 className="text-lg font-bold text-ink group-hover:text-brand">{c.title}</h3>
                      <p className="mt-0.5 text-sm text-muted">{c.instructor.name}</p>
                      <p className="mt-1 text-sm text-muted">
                        <span className="font-bold text-brand">{(c.averageRating ?? 0).toFixed(1)}</span> ★ ({(c._count.enrollments ?? 0).toLocaleString()} students)
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <span className="text-lg font-extrabold">
                          {netPrice(c) === 0 ? 'Free' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(netPrice(c))}
                        </span>
                        <span className="flex items-center gap-1 text-sm font-semibold text-brand">View course <ArrowRight className="h-4 w-4" /></span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {page < lastPage && (
              <div className="mt-10 text-center">
                <button onClick={loadMore} disabled={loadingMore} className="rounded-full border border-line bg-card px-10 py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand disabled:opacity-60">
                  {loadingMore ? 'Loading…' : 'Load More Courses'}
                </button>
                <p className="mt-3 text-[13px] text-muted">Showing 1-{visible.length} of {total.toLocaleString()} courses</p>
              </div>
            )}
          </div>
        </div>

        {/* Popular categories */}
        {categories.length > 0 && (
          <div className="mt-16 border-t border-line pt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink">Popular Categories</h2>
              <Link href="/courses" className="text-sm font-semibold text-brand hover:underline">View All Categories</Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {categories.slice(0, 6).map((cat) => (
                <Link key={cat.id} href={`/courses?category=${cat.slug}`} className="group rounded-2xl border border-line bg-card p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
                    <CategoryIcon name={cat.name} className="h-5 w-5" />
                  </span>
                  <span className="mt-3 block text-sm font-bold text-ink group-hover:text-brand">{cat.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom popular-categories band like the reference */}
      <div className="border-t border-line bg-[#f4f5f7]">
        <div className="container-page flex items-center gap-3 overflow-x-auto py-6 text-sm text-muted">
          <BookOpen className="h-4 w-4 shrink-0 text-brand" />
          <span className="whitespace-nowrap">Not sure where to start?</span>
          <Link href="/courses" className="whitespace-nowrap font-semibold text-brand hover:underline">Take the career quiz →</Link>
        </div>
      </div>
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
