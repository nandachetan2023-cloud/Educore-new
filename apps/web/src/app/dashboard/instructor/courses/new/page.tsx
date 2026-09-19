'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { Category } from '@/lib/types';

interface Named { id: number; name: string }

export default function NewCoursePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [levels, setLevels] = useState<Named[]>([]);
  const [languages, setLanguages] = useState<Named[]>([]);
  const [form, setForm] = useState({ title: '', categoryId: '', courseLevelId: '', courseLanguageId: '', price: '', discount: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') { router.push('/login?next=/dashboard/instructor/courses/new'); return; }
    Promise.all([
      api<Category[]>('/categories', { auth: false }),
      api<Named[]>('/levels', { auth: false }),
      api<Named[]>('/languages', { auth: false }),
    ]).then(([c, l, lang]) => { setCategories(c); setLevels(l); setLanguages(lang); }).catch(() => {});
  }, [user, authLoading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: any = { title: form.title, description: form.description };
      if (form.categoryId) payload.categoryId = Number(form.categoryId);
      if (form.courseLevelId) payload.courseLevelId = Number(form.courseLevelId);
      if (form.courseLanguageId) payload.courseLanguageId = Number(form.courseLanguageId);
      if (form.price) payload.price = Number(form.price);
      if (form.discount) payload.discount = Number(form.discount);
      const course = await api<{ id: number }>('/courses', { method: 'POST', body: JSON.stringify(payload) });
      router.push(`/dashboard/instructor/courses/${course.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create course');
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold">Create a new course</h1>
      <p className="mt-1 text-muted">Start with the basics — you can add content next.</p>

      <form onSubmit={submit} className="card mt-8 space-y-5 p-6">
        <div>
          <label className="label">Course title</label>
          <input required className="input" value={form.title} onChange={set('title')} placeholder="e.g. Complete Web Development Bootcamp" />
        </div>
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
              {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Price</label>
            <input type="number" min="0" step="0.01" className="input" value={form.price} onChange={set('price')} placeholder="0 for free" />
          </div>
          <div>
            <label className="label">Discount</label>
            <input type="number" min="0" step="0.01" className="input" value={form.discount} onChange={set('discount')} placeholder="0" />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={5} className="input" value={form.description} onChange={set('description')} placeholder="What will students learn?" />
        </div>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <button disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create & add content'}</button>
          <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  );
}
