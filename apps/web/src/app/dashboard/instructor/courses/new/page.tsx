'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { Category } from '@/lib/types';
import { BookOpen, CheckCircle2 } from 'lucide-react';

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
    setBusy(true); setError(null);
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
    } finally { setBusy(false); }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const filled = [form.title, form.categoryId, form.description, form.price].filter(Boolean).length;
  const total = 4;

  return (
    <div className="min-h-screen bg-[#F8F6F1]">
      <div className="container-page max-w-4xl py-10">
        <div className="flex items-center gap-2 text-sm text-muted">
          <BookOpen size={16} /> Course Builder
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Create a new course</h1>
        <p className="mt-2 text-muted">Build an engaging course in minutes. Fill the details below, then add chapters.</p>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-[#EAE6DB]">
            <div className="h-2 rounded-full bg-brand transition-all duration-300" style={{ width: `${(filled / total) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold text-muted whitespace-nowrap">{filled} / {total} complete</span>
        </div>

        <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="card p-6 space-y-5">
              <h2 className="font-bold text-lg flex items-center gap-2">Basic info</h2>
              <div>
                <label className="label">Course title</label>
                <input required className="input w-full" value={form.title} onChange={set('title')} placeholder="e.g. Complete Web Development Bootcamp" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={4} className="input w-full" value={form.description} onChange={set('description')} placeholder="What will students learn? Outcomes, prerequisites, etc." />
              </div>
            </section>

            <section className="card p-6 space-y-5">
              <h2 className="font-bold text-lg">Settings</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label">Category</label>
                  <select className="input w-full" value={form.categoryId} onChange={set('categoryId')}>
                    <option value="">Select…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Level</label>
                  <select className="input w-full" value={form.courseLevelId} onChange={set('courseLevelId')}>
                    <option value="">Select…</option>
                    {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Language</label>
                  <select className="input w-full" value={form.courseLanguageId} onChange={set('courseLanguageId')}>
                    <option value="">Select…</option>
                    {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex gap-2 items-center">
                    <label className="label">Price (USD)</label>
                    <button type="button" onClick={() => setForm(f => ({...f, price: f.price === '29.99' ? '49.99' : '29.99'}))} className="ml-auto text-xs font-semibold text-brand hover:underline">Modify</button>
                  </div>
                  <input type="number" min="0" step="0.01" className="input w-full" value={form.price} onChange={set('price')} placeholder="0 for free" />
                </div>
                <div>
                  <label className="label">Discount (%)</label>
                  <input type="number" min="0" step="0.01" className="input w-full" value={form.discount} onChange={set('discount')} placeholder="0" />
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-6 space-y-4">
              <h3 className="font-bold">Quick tips</h3>
              <ul className="space-y-3 text-sm text-muted">
                <li className="flex gap-2"><CheckCircle2 size={16} className="text-brand shrink-0" /> A clear title helps students find your course.</li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="text-brand shrink-0" /> Add chapters after creating the course.</li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="text-brand shrink-0" /> Use the description to explain outcomes.</li>
              </ul>
            </section>
            <div className="card p-6 bg-brand-soft border-brand/10 space-y-4">
              <h3 className="font-bold">Course preview</h3>
              <div className="text-sm text-muted">{form.title || 'Untitled course'}</div>
              <div className="text-xs text-muted">{form.description ? form.description.slice(0, 120) + (form.description.length > 120 ? '…' : '') : 'No description yet.'}</div>
              <div className="flex gap-2 text-xs font-semibold text-brand">
                <span className="badge">{categories.find(c => c.id === Number(form.categoryId))?.name || 'No category'}</span>
                <span className="badge">{levels.find(l => l.id === Number(form.courseLevelId))?.name || 'No level'}</span>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-3 flex gap-3 pt-4">
            <button disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create course'}</button>
            <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
          </div>
        </form>
        {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
