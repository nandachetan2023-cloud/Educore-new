'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { ImageUpload } from '@/components/image-upload';
import type { Category } from '@/lib/types';

interface Named { id: number; name: string }

export default function EditCoursePage({ params }: { params: { id: string } }) {
  const courseId = Number(params.id);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [levels, setLevels] = useState<Named[]>([]);
  const [languages, setLanguages] = useState<Named[]>([]);
  const [form, setForm] = useState({ title: '', categoryId: '', courseLevelId: '', courseLanguageId: '', price: '', discount: '', description: '', seoDescription: '', thumbnail: '' });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') { router.push('/login'); return; }
    Promise.all([
      api<Category[]>('/categories', { auth: false }),
      api<Named[]>('/levels', { auth: false }),
      api<Named[]>('/languages', { auth: false }),
      api<any[]>('/courses/mine'),
    ]).then(([c, l, lang, mine]) => {
      setCategories(c); setLevels(l); setLanguages(lang);
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
              {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Price</label><input type="number" min="0" step="0.01" className="input" value={form.price} onChange={set('price')} /></div>
          <div><label className="label">Discount</label><input type="number" min="0" step="0.01" className="input" value={form.discount} onChange={set('discount')} /></div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={5} className="input" value={form.description} onChange={set('description')} />
        </div>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
