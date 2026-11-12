'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { ImageUpload } from '@/components/image-upload';
import type { Category } from '@/lib/types';

interface Named { id: number; name: string }
interface Tag { id: number; name: string; slug: string }

export default function EditCoursePage({ params }: { params: { id: string } }) {
  const courseId = Number(params.id);
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const currency = branding?.currency ?? 'INR';
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [levels, setLevels] = useState<Named[]>([]);
  const [languages, setLanguages] = useState<Named[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [form, setForm] = useState({ title: '', categoryId: '', courseLevelId: '', courseLanguageId: '', price: '', discount: '', description: '', seoDescription: '', thumbnail: '', capacity: '', certificate: false, qna: false, tagIds: [] as number[] });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(courseId)) { router.replace('/dashboard/instructor/courses'); return; }
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') { router.push('/login'); return; }
    Promise.all([
      api<{ categories: Category[]; levels: Named[]; languages: Named[]; tags?: Tag[] }>('/taxonomy').then((t) => ({
        categories: t.categories ?? [],
        levels: t.levels ?? [],
        languages: t.languages ?? [],
        tags: t.tags ?? [],
      })),
      api<any[]>('/courses/mine'),
    ]).then(([t, mine]) => {
      const c = t.categories; const l = t.levels; const lang = t.languages;
      setCategories(c); setLevels(l); setLanguages(lang); setTags(t.tags);
      const course = mine.find((m) => m.id === courseId);
      if (course) {
        setForm({
          title: course.title ?? '',
          categoryId: course.categoryId ? String(course.categoryId) : '',
          courseLevelId: course.courseLevelId ? String(course.courseLevelId) : '',
          courseLanguageId: course.courseLanguageId ? String(course.courseLanguageId) : '',
          price: course.price != null ? String(course.price) : '',
          discount: course.discount != null ? String(course.discount) : '',
          description: course.description ?? '',
          seoDescription: course.seoDescription ?? '',
          thumbnail: course.thumbnail ?? '',
          capacity: course.capacity != null ? String(course.capacity) : '',
          certificate: Boolean(course.certificate),
          qna: Boolean(course.qna),
          tagIds: (course.tags ?? []).map((t: Tag) => t.id),
        });
      }
    }).catch(() => {});
  }, [user, authLoading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null);
    try {
      const payload: any = { title: form.title, description: form.description, seoDescription: form.seoDescription, thumbnail: form.thumbnail };
      if (form.categoryId) payload.categoryId = Number(form.categoryId);
      if (form.courseLevelId) payload.courseLevelId = Number(form.courseLevelId);
      if (form.courseLanguageId) payload.courseLanguageId = Number(form.courseLanguageId);
      if (form.price) payload.price = Number(form.price);
      if (form.discount) payload.discount = Number(form.discount);
      payload.capacity = form.capacity === '' ? 0 : Number(form.capacity);
      payload.certificate = form.certificate;
      payload.qna = form.qna;
      payload.tagIds = form.tagIds;
      await api(`/courses/${courseId}`, { method: 'PUT', body: JSON.stringify(payload) });
      setMsg('Saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleTag = (tagId: number) =>
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((id) => id !== tagId) : [...f.tagIds, tagId],
    }));

  const createTag = async () => {
    const name = tagInput.trim();
    if (!name) return;
    setTagInput('');
    try {
      const tag = await api<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name }) });
      setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
      setForm((f) => ({ ...f, tagIds: f.tagIds.includes(tag.id) ? f.tagIds : [...f.tagIds, tag.id] }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create tag');
    }
  };

  if (authLoading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href={`/dashboard/instructor/courses/${courseId}`} className="text-sm text-muted hover:text-brand">← Back to builder</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Edit course details</h1>

      <form onSubmit={submit} className="card mt-8 space-y-5 p-6">
        <div>
          <label className="label">Title</label>
          <input required className="input" value={form.title} onChange={set('title')} />
        </div>
        <ImageUpload label="Course thumbnail" value={form.thumbnail} onChange={(url) => setForm((f) => ({ ...f, thumbnail: url }))} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.categoryId} onChange={set('categoryId')}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Level</label>
            <select className="input" value={form.courseLevelId} onChange={set('courseLevelId')}>
              <option value="">Select…</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Language</label>
            <select className="input" value={form.courseLanguageId} onChange={set('courseLanguageId')}>
              <option value="">Select…</option>
              {languages.filter((l) => ['english', 'hindi'].includes(l.name.trim().toLowerCase())).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Price ({currency})</label><input type="number" min="0" step="0.01" className="input" value={form.price} onChange={set('price')} /></div>
          <div><label className="label">Discount</label><input type="number" min="0" step="0.01" className="input" value={form.discount} onChange={set('discount')} /></div>
        </div>
        <div>
          <label className="label">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = form.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className="badge"
                  onClick={() => toggleTag(tag.id)}
                  aria-pressed={active}
                  style={{ cursor: 'pointer', opacity: active ? 1 : 0.55, boxShadow: active ? 'inset 0 0 0 2px currentColor' : undefined }}
                >
                  {tag.name}
                </button>
              );
            })}
            {tags.length === 0 && <span className="text-sm text-muted">No tags yet — add the first one below.</span>}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void createTag();
                }
              }}
              placeholder="Create a tag, e.g. Python"
            />
            <button type="button" className="btn-ghost" onClick={createTag} disabled={!tagInput.trim()}>Add</button>
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={5} className="input" value={form.description} onChange={set('description')} />
        </div>

        <div className="space-y-4 rounded-xl border border-line p-4">
          <div>
            <p className="font-bold">Course settings &amp; learner access</p>
            <p className="text-xs text-muted">Who can enroll and what they get on completion.</p>
          </div>
          <div>
            <label className="label">Seat limit</label>
            <input type="number" min="0" step="1" className="input" placeholder="0 = unlimited" value={form.capacity} onChange={set('capacity')} />
            <p className="mt-1 text-xs text-muted">Leave 0 for unlimited enrollments.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={form.certificate} onChange={(e) => setForm((f) => ({ ...f, certificate: e.target.checked }))} className="h-4 w-4 rounded accent-[var(--brand-primary)]" />
              Issue a certificate on completion
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={form.qna} onChange={(e) => setForm((f) => ({ ...f, qna: e.target.checked }))} className="h-4 w-4 rounded accent-[var(--brand-primary)]" />
              Enable Q&amp;A with the instructor
            </label>
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
