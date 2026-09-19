'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

interface Lesson { id: number; title: string; duration: string; fileType: string; isPreview: boolean }
interface Chapter { id: number; title: string; order: number; lessons: Lesson[] }

/** Reorders `items` by moving the element at `from` to `to`, returning a new array. */
function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function CourseBuilderPage({ params }: { params: { id: string } }) {
  const courseId = Number(params.id);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChapter, setNewChapter] = useState('');
  const [lessonFor, setLessonFor] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(() => {
    api<Chapter[]>(`/courses/${courseId}/content`)
      .then(setChapters)
      .catch(() => setChapters([]))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') { router.push('/login'); return; }
    load();
  }, [user, authLoading]);

  const addChapter = async () => {
    if (!newChapter.trim()) return;
    setErr(null);
    try {
      await api(`/courses/${courseId}/content/chapters`, {
        method: 'POST',
        body: JSON.stringify({ title: newChapter, order: chapters.length + 1 }),
      });
      setNewChapter('');
      load();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed'); }
  };

  const removeChapter = async (id: number) => {
    await api(`/courses/${courseId}/content/chapters/${id}`, { method: 'DELETE' });
    load();
  };
  const removeLesson = async (id: number) => {
    await api(`/courses/${courseId}/content/lessons/${id}`, { method: 'DELETE' });
    load();
  };

  const reorderChapters = async (from: number, to: number) => {
    if (from === to) return;
    const next = moveItem(chapters, from, to);
    setChapters(next);
    setSavingOrder(true);
    try {
      await api(`/courses/${courseId}/content/chapters/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ ids: next.map((c) => c.id) }),
      });
    } catch {
      load(); // revert to server truth on failure
    } finally {
      setSavingOrder(false);
    }
  };

  const reorderLessons = async (chapterId: number, from: number, to: number) => {
    if (from === to) return;
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;
    const nextLessons = moveItem(chapter.lessons, from, to);
    setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, lessons: nextLessons } : c)));
    setSavingOrder(true);
    try {
      await api(`/courses/${courseId}/content/lessons/reorder/${chapterId}`, {
        method: 'PUT',
        body: JSON.stringify({ ids: nextLessons.map((l) => l.id) }),
      });
    } catch {
      load();
    } finally {
      setSavingOrder(false);
    }
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/dashboard/instructor" className="text-sm text-muted hover:text-brand">← Back to dashboard</Link>
      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Course builder</h1>
        <Link href={`/dashboard/instructor/courses/${courseId}/edit`} className="btn-ghost">Edit details</Link>
      </div>
      <p className="mt-1 text-muted">
        Organize your course into sections and lessons — drag the ⠿ handle to reorder. It goes live once an admin approves it.
        {savingOrder && <span className="ml-2 text-xs text-brand">Saving order…</span>}
      </p>

      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      {/* Add chapter */}
      <div className="card mt-8 flex gap-3 p-4">
        <input className="input" placeholder="New section title…" value={newChapter} onChange={(e) => setNewChapter(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addChapter()} />
        <button onClick={addChapter} className="btn-primary shrink-0">Add section</button>
      </div>

      {/* Chapters */}
      <div className="mt-6 space-y-4">
        {chapters.length === 0 && <div className="card p-10 text-center text-muted">No sections yet. Add your first one above.</div>}
        {chapters.map((ch, chapterIndex) => (
          <DraggableRow
            key={ch.id}
            index={chapterIndex}
            onDrop={(from, to) => reorderChapters(from, to)}
            className="card overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-3">
              <span className="flex items-center gap-2 font-semibold">
                <DragHandle />
                {ch.title}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setLessonFor(lessonFor === ch.id ? null : ch.id)} className="text-sm font-medium text-brand hover:underline">+ Lesson</button>
                <button onClick={() => removeChapter(ch.id)} className="text-sm text-red-500 hover:underline">Delete</button>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {ch.lessons.map((l, lessonIndex) => (
                <DraggableRow
                  key={l.id}
                  index={lessonIndex}
                  onDrop={(from, to) => reorderLessons(ch.id, from, to)}
                  as="li"
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <DragHandle small />
                    <span className="text-muted">{l.fileType === 'video' ? '▶' : '📄'}</span>
                    {l.title}
                    {l.isPreview && <span className="badge">Preview</span>}
                  </span>
                  <span className="flex items-center gap-3 text-muted">
                    {l.duration}
                    <button onClick={() => removeLesson(l.id)} className="text-red-500 hover:underline">Remove</button>
                  </span>
                </DraggableRow>
              ))}
              {ch.lessons.length === 0 && <li className="px-5 py-3 text-sm text-muted">No lessons yet.</li>}
            </ul>
            {lessonFor === ch.id && (
              <LessonForm
                courseId={courseId}
                chapterId={ch.id}
                order={ch.lessons.length + 1}
                onDone={() => { setLessonFor(null); load(); }}
              />
            )}
          </DraggableRow>
        ))}
      </div>
    </div>
  );
}

function DragHandle({ small }: { small?: boolean }) {
  return (
    <span
      className={`cursor-grab select-none text-muted active:cursor-grabbing ${small ? 'text-xs' : 'text-base'}`}
      aria-hidden
      title="Drag to reorder"
    >
      ⠿
    </span>
  );
}

/**
 * Generic HTML5-drag-and-drop wrapper. Dragging is only initiated from a
 * descendant with `cursor-grab` (the ⠿ handle) via draggable on the row,
 * but since HTML5 DnD requires `draggable` on the element itself, we make
 * the whole row draggable and rely on the handle purely as a visual/UX cue.
 */
function DraggableRow({
  index,
  onDrop,
  children,
  className,
  as = 'div',
}: {
  index: number;
  onDrop: (from: number, to: number) => void;
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'li';
}) {
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const Tag = as;

  return (
    <Tag
      draggable
      onDragStart={(e: React.DragEvent) => {
        dragIndex.current = index;
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const from = dragIndex.current;
        if (from !== null && from !== index) onDrop(from, index);
        dragIndex.current = null;
      }}
      onDragEnd={() => setDragOver(false)}
      className={`${className ?? ''} ${dragOver ? 'ring-2 ring-brand ring-inset' : ''}`}
    >
      {children}
    </Tag>
  );
}

function LessonForm({ courseId, chapterId, order, onDone }: { courseId: number; chapterId: number; order: number; onDone: () => void }) {
  const [form, setForm] = useState({
    title: '', storage: 'youtube', filePath: '', fileType: 'video', lessonType: 'lesson',
    duration: '', isPreview: false, downloadable: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/courses/${courseId}/content/lessons`, {
        method: 'POST',
        body: JSON.stringify({ ...form, chapterId, order }),
      });
      onDone();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed'); setBusy(false); }
  };

  return (
    <div className="space-y-3 border-t border-line bg-brand-soft/30 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="Lesson title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <input className="input" placeholder="Duration (e.g. 8:20)" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
        <select className="input" value={form.storage} onChange={(e) => setForm((f) => ({ ...f, storage: e.target.value }))}>
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
          <option value="upload">Upload URL</option>
          <option value="external_link">External link</option>
        </select>
        <select className="input" value={form.fileType} onChange={(e) => setForm((f) => ({ ...f, fileType: e.target.value }))}>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="pdf">PDF</option>
          <option value="doc">Doc</option>
          <option value="file">File</option>
        </select>
      </div>
      <input className="input" placeholder="Video/file URL or ID" value={form.filePath} onChange={(e) => setForm((f) => ({ ...f, filePath: e.target.value }))} />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPreview} onChange={(e) => setForm((f) => ({ ...f, isPreview: e.target.checked }))} /> Free preview</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.downloadable} onChange={(e) => setForm((f) => ({ ...f, downloadable: e.target.checked }))} /> Downloadable</label>
      </div>
      {err && <p className="text-sm text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="btn-primary py-2">{busy ? 'Adding…' : 'Add lesson'}</button>
        <button onClick={onDone} className="btn-ghost py-2">Cancel</button>
      </div>
    </div>
  );
}
