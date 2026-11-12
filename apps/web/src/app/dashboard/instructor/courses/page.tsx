'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen, Hammer, Layers, LayoutDashboard, MoreVertical, Pencil,
  Plus, Search, Sparkles, Trash2, Wallet,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { createDraftCourse } from '@/lib/create-course';
import { DirectoryShell } from '@/components/directory-shell';

interface MyCourse {
  id: number;
  title: string;
  slug: string;
  status: string;
  isApproved: string;
  price?: number;
  createdAt?: string;
  _count: { enrollments: number; chapters: number };
}

type StatusFilter = 'all' | 'published' | 'draft' | 'review' | 'rejected';

export default function MyCoursesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const branding = useBranding();
  const currency = branding?.currency ?? 'INR';
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  const router = useRouter();
  const createAndGo = async () => {
    const id = await createDraftCourse();
    if (id) router.push(`/dashboard/instructor/courses/${id}`);
  };
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<MyCourse[]>('/courses/mine')
      .then(setCourses)
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') {
      router.push('/login?next=/dashboard/instructor/courses');
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const s = params.get('status');
    if (s === 'published' || s === 'draft' || s === 'review' || s === 'rejected') setFilter(s);
    load();
  }, [user, authLoading, router]);

  const bucketOf = (c: MyCourse): StatusFilter => {
    if (c.isApproved === 'pending') return 'review';
    if (c.isApproved === 'rejected') return 'rejected';
    if (c.status === 'active') return 'published';
    return 'draft';
  };

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: courses.length, published: 0, draft: 0, review: 0, rejected: 0 };
    for (const course of courses) c[bucketOf(course)] += 1;
    return c;
  }, [courses]);

  const filtered = useMemo(
    () =>
      courses.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) &&
          (filter === 'all' || bucketOf(c) === filter),
      ),
    [courses, query, filter],
  );

  const badge = (c: MyCourse) => {
    const b = bucketOf(c);
    const base = 'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide';
    if (b === 'review') return <span className={`${base} bg-amber-500/10 text-amber-600`}>In Review</span>;
    if (b === 'rejected') return <span className={`${base} bg-red-500/10 text-red-500`}>Rejected</span>;
    if (b === 'published') return <span className={`${base} bg-green-500/10 text-green-600`}>Published</span>;
    return <span className={`${base} bg-violet-100 text-violet-700`}>Draft</span>;
  };

  const nextStep = (c: MyCourse) =>
    c._count.chapters === 0 ? 'Next: add a section' : 'Next: add lessons';

  const remove = async (c: MyCourse) => {
    if (!confirm(`Delete "${c.title}"? This cannot be undone.`)) return;
    setError(null);
    setDeleting(c.id);
    setMenuFor(null);
    try {
      await api(`/courses/${c.id}`, { method: 'DELETE' });
      setCourses((list) => list.filter((x) => x.id !== c.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete course');
    } finally {
      setDeleting(null);
    }
  };

  if (authLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted">Loading…</div>;
  }

  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All Courses' },
    { id: 'draft', label: 'Drafts' },
    { id: 'published', label: 'Published' },
    { id: 'review', label: 'In Review' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <DirectoryShell
      eyebrow="Instructor Studio"
      sections={[
        {
          heading: 'Courses',
          links: [
            { href: '/dashboard/instructor', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/dashboard/instructor/courses', label: 'My Courses', icon: Layers, badge: counts.draft || undefined },
            { label: 'Create Course', icon: Plus, onClick: createAndGo },
            { href: '/dashboard/instructor/payouts', label: 'Payouts', icon: Wallet },
            { href: '/courses', label: 'Browse Catalog', icon: BookOpen },
          ],
        },
        {
          heading: 'AI Tools',
          links: [
            { label: 'Generate Course', icon: Sparkles, onClick: createAndGo },
            { label: 'Generate Content', icon: Sparkles, onClick: createAndGo },
            { label: 'Outline from Topic', icon: Sparkles, onClick: createAndGo },
          ],
        },
      ]}
      userName={user?.name ?? 'Instructor'}
      userCaption="Instructor"
      userImage={user?.image}
      onLogout={logout}
    >
      {/* ── Page header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-semibold tracking-tight text-ink">My Courses</h1>
          <p className="text-sm text-muted">Create, build and publish your catalog</p>
        </div>
        <button onClick={createAndGo} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110">
          <Plus className="h-4 w-4" /> Create Course
        </button>
      </div>

      {/* ── Build with AI promo ─────────────────────────── */}
      <div className="mt-5 flex flex-col items-start gap-4 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 p-5 sm:flex-row sm:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md">
          <Sparkles className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-violet-950">Build with AI ✨</p>
          <p className="text-xs text-violet-900/80 sm:text-[13px]">Create a complete course from a topic in minutes — sections, lessons and quizzes generated for you.</p>
        </div>
        <button onClick={createAndGo} className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700">
          Try AI Course Builder →
        </button>
      </div>

      {/* ── Filters + search ────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                filter === f.id ? 'bg-violet-600 text-white shadow-sm' : 'border border-line bg-white text-muted hover:text-ink'
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${filter === f.id ? 'bg-white/20 text-white' : 'bg-[#F0EFFA] text-violet-800'}`}>
                {counts[f.id]}
              </span>
            </button>
          ))}
        </div>
        <label className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses..."
            className="w-56 rounded-full border border-line bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </label>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>}

      {/* ── Course list ─────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-white p-14 text-center shadow-sm">
          <span className="material-symbols-outlined text-6xl text-violet-200">school</span>
          <p className="mt-2 font-bold text-ink">
            {courses.length === 0 ? "You haven't created any courses yet" : 'No courses match your filters'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {courses.length === 0 ? 'Start from a topic with the AI Course Builder, or build it manually.' : 'Try clearing the search or switching the filter.'}
          </p>
          {courses.length === 0 && (
            <button onClick={createAndGo} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700">
              <Plus className="h-4 w-4" /> Create your first course
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[12px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3.5 font-semibold">Course</th>
                <th className="px-5 py-3.5 font-semibold">Sections</th>
                <th className="px-5 py-3.5 font-semibold">Enrollments</th>
                <th className="px-5 py-3.5 font-semibold">Price</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((c) => (
                <tr key={c.id} className="transition hover:bg-violet-50/40">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-line">
                        <img src={`https://picsum.photos/seed/educore-${c.id}/320/180`} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[260px] truncate font-bold text-ink">{c.title}</span>
                        <span className="mt-0.5 block text-[11px] text-muted">{bucketOf(c) === 'published' ? 'Live on the marketplace' : nextStep(c)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted">◷ {c._count.chapters}</td>
                  <td className="px-5 py-4 font-semibold text-ink">{c._count.enrollments.toLocaleString()}</td>
                  <td className="px-5 py-4 font-bold text-green-600">{c.price ? money(c.price) : 'Free'}</td>
                  <td className="px-5 py-4">{badge(c)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/instructor/courses/${c.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-[12px] font-bold text-violet-700 transition hover:bg-violet-100"
                      >
                        <Hammer className="h-3.5 w-3.5" /> Builder
                      </Link>
                      <div className="relative">
                        <button onClick={() => setMenuFor((m) => (m === c.id ? null : c.id))} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" aria-label="More actions">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuFor === c.id && (
                          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
                            <Link href={`/dashboard/instructor/courses/${c.id}/edit`} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink hover:bg-violet-50">
                              <Pencil className="h-3.5 w-3.5" /> Edit details
                            </Link>
                            <button onClick={() => remove(c)} disabled={deleting === c.id} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                              <Trash2 className="h-3.5 w-3.5" /> Delete course
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DirectoryShell>
  );
}
