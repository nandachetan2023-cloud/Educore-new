'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Save } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';

interface Lesson {
  id: number;
  title: string;
  duration: string;
  fileType: string;
  storage: string;
  filePath: string;
  description?: string | null;
  isPreview: boolean;
  downloadable: boolean;
  order: number;
}

interface Chapter {
  id: number;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface CourseMeta {
  id: number;
  title: string;
  slug: string;
  status: string;
  isApproved: string;
  price?: number;
  discount?: number;
}

const FILE_ICON: Record<string, string> = {
  video: 'play_circle',
  audio: 'audiotrack',
  pdf: 'picture_as_pdf',
  doc: 'article',
  file: 'attach_file',
};

const STORAGE_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  upload: 'Upload URL',
  external_link: 'External link',
};

export default function CourseStudioPage({ params }: { params: { id: string } }) {
  const courseId = Number(params.id);
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [course, setCourse] = useState<CourseMeta | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newChapter, setNewChapter] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api<any[]>('/courses/mine').then((mine) => mine.find((m) => m.id === courseId) ?? null),
      api<Chapter[]>(`/courses/${courseId}/content`).catch(() => []),
    ])
      .then(([c, ch]) => {
        setCourse(c);
        setChapters(ch);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'instructor') {
      router.push('/login');
      return;
    }
    load();
  }, [user, authLoading]);

  const selected = chapters.flatMap((c) => c.lessons).find((l) => l.id === selectedId) ?? null;

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
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to add module');
    }
  };

  const removeChapter = async (id: number) => {
    if (!confirm('Delete this module and all its lessons?')) return;
    await api(`/courses/${courseId}/content/chapters/${id}`, { method: 'DELETE' });
    setSelectedId(null);
    load();
  };

  const removeLesson = async (id: number) => {
    if (!confirm('Delete this lesson?')) return;
    await api(`/courses/${courseId}/content/lessons/${id}`, { method: 'DELETE' });
    setSelectedId(null);
    load();
  };

  const saveLesson = async (lesson: Lesson) => {
    const chapter = chapters.find((c) => c.lessons.some((l) => l.id === lesson.id));
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await api(`/courses/${courseId}/content/lessons/${lesson.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: lesson.title,
          chapterId: chapter?.id ?? 0,
          order: lesson.order,
          filePath: lesson.filePath,
          storage: lesson.storage || 'upload',
          fileType: lesson.fileType || 'video',
          lessonType: 'lesson',
          duration: lesson.duration || '0:00',
          description: lesson.description ?? '',
          isPreview: lesson.isPreview,
          downloadable: lesson.downloadable,
          status: true,
        }),
      });
      setMsg('Lesson saved - auto-saved');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const patchSelected = (patch: Partial<Lesson>) => {
    setChapters((prev) =>
      prev.map((c) => ({
        ...c,
        lessons: c.lessons.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)),
      })),
    );
  };

  if (authLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted">Loading course studio...</div>;
  }

  const totalLessons = chapters.reduce((n, c) => n + c.lessons.length, 0);
  const statusLabel =
    course?.isApproved === 'approved' && course?.status === 'active'
      ? 'Published'
      : course?.isApproved === 'pending'
        ? 'Pending review'
        : 'Draft';
  const isPublished = statusLabel === 'Published';
  // Setup progress derived from real course state.
  const setupProgress = Math.min(
    100,
    25 + (chapters.length > 0 ? 25 : 0) + (totalLessons > 0 ? 25 : 0) + (course?.price != null ? 10 : 0) + (isPublished ? 15 : 0),
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Reference-style builder header */}
      <div className="border-b border-line bg-card">
        <div className="mx-auto max-w-[1780px] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/dashboard/instructor" aria-label="Back to dashboard" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-lg font-bold tracking-tight text-ink sm:text-xl">{course?.title ?? 'Untitled course'}</h1>
                  {!isPublished && (
                    <span className="rounded-full border border-brand/30 bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">Draft</span>
                  )}
                  {isPublished && (
                    <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-bold text-green-600">Published</span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-muted">Last saved just now · {chapters.length} sections · {totalLessons} lessons</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-1 hidden text-right sm:block">
                <div className="text-xs font-semibold text-ink">Setup Progress: {setupProgress}%</div>
                <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${setupProgress}%` }} />
                </div>
              </div>
              {course?.slug && (
                <Link href={`/courses/${course.slug}`} className="btn-ghost rounded-full text-sm">
                  <Eye className="h-4 w-4" /> Preview
                </Link>
              )}
              <Link href={`/dashboard/instructor/courses/${courseId}/edit`} className="btn-ghost rounded-full text-sm">
                <Save className="h-4 w-4" /> Details
              </Link>
            </div>
          </div>
          {/* Steps */}
          <div className="mx-auto mt-4 flex max-w-3xl gap-2 rounded-2xl bg-surface p-1.5 text-sm">
            <Link href={`/dashboard/instructor/courses/${courseId}/edit`} className="flex-1 rounded-xl py-2 text-center font-medium text-muted transition hover:text-ink">
              1. Details
            </Link>
            <span className="flex-1 rounded-xl bg-card py-2 text-center font-bold text-ink shadow-sm">2. Curriculum</span>
            <Link href={`/dashboard/instructor/courses/${courseId}/edit`} className="flex-1 rounded-xl py-2 text-center font-medium text-muted transition hover:text-ink">
              3. Media
            </Link>
            <Link href={`/dashboard/instructor/courses/${courseId}/edit`} className="flex-1 rounded-xl py-2 text-center font-medium text-muted transition hover:text-ink">
              4. Settings
            </Link>
          </div>
        </div>
      </div>

      {(err || msg) && (
        <div className="mx-auto mt-4 max-w-[1780px] px-6">
          {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{err}</p>}
          {msg && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{msg}</p>}
        </div>
      )}

      <div className="mx-auto max-w-[1780px] px-6 py-6">
        <div className="grid grid-cols-12 items-start gap-6">
          {/* Left: outline */}
          <div className="col-span-12 flex flex-col gap-4 xl:col-span-3">
            <div className="rounded-xl border border-line bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-muted">account_tree</span>
                  <span className="font-semibold text-ink">Curriculum Outline</span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">{chapters.length} Modules</span>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {chapters.length === 0 && (
                  <div className="rounded-lg bg-surface p-8 text-center text-sm text-muted">No modules yet. Add your first section below.</div>
                )}
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className={`rounded-xl border ${
                      selected && ch.lessons.some((l) => l.id === selected.id) ? 'border-brand/40 bg-surface' : 'border-line bg-surface/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 p-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="material-symbols-outlined cursor-grab select-none text-base text-muted">drag_indicator</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{ch.title}</p>
                          <p className="text-xs font-semibold text-green-600">
                            {ch.lessons.length} lesson{ch.lessons.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedId(null);
                            setShowForm((s) => !s);
                          }}
                          className="rounded p-1 text-brand hover:bg-surface"
                          title="Add lesson"
                        >
                          <span className="material-symbols-outlined text-base">add_circle_outline</span>
                        </button>
                        <button onClick={() => removeChapter(ch.id)} className="rounded p-1 text-muted hover:text-red-600" title="Delete module">
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 px-3 pb-3">
                      {ch.lessons.map((l) => (
                        <div key={l.id} className="group flex w-full items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedId(l.id);
                              setShowForm(false);
                            }}
                            className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                              selectedId === l.id ? 'bg-brand/10 text-brand' : 'bg-surface text-ink hover:bg-surface/70'
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm text-muted">{FILE_ICON[l.fileType] ?? 'play_circle'}</span>
                            <span className="truncate">{l.title}</span>
                            <span className="ml-auto shrink-0 text-xs text-muted">{l.duration}</span>
                          </button>
                          <button
                            onClick={() => removeLesson(l.id)}
                            className="hidden shrink-0 rounded p-1 text-muted hover:text-red-600 group-hover:block"
                            title="Delete lesson"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ))}
                      {ch.lessons.length === 0 && <p className="px-2 py-1 text-xs text-muted">No lessons yet.</p>}
                    </div>
                  </div>
                ))}
              </div>

              {showForm && (
                <LessonForm
                  courseId={courseId}
                  chapterId={chapters[chapters.length - 1]?.id}
                  onDone={() => {
                    setShowForm(false);
                    load();
                  }}
                  onCancel={() => setShowForm(false)}
                />
              )}

              <div className="mt-3 flex gap-2">
                <input
                  className="input !rounded-lg !py-2 text-sm"
                  placeholder="New section title..."
                  value={newChapter}
                  onChange={(e) => setNewChapter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addChapter()}
                />
                <button onClick={addChapter} className="btn-primary shrink-0 !rounded-lg !px-3 !py-2 text-xs">
                  <span className="material-symbols-outlined text-base">create_new_folder</span> Add
                </button>
              </div>
            </div>
          </div>

          {/* Center: lesson editor */}
          <div className="col-span-12 flex flex-col gap-4 xl:col-span-6">
            {selected ? (
              <LessonEditor lesson={selected} busy={busy} onPatch={patchSelected} onSave={() => saveLesson(selected)} />
            ) : (
              <div className="rounded-xl border border-line bg-card p-10 text-center">
                <span className="material-symbols-outlined text-5xl text-brand/30">auto_videocam</span>
                <h3 className="mt-3 text-lg font-bold text-ink">Select a lesson to edit</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  Choose a lesson from the Curriculum Outline to open it in the editor, or add a new lecture.
                </p>
                <button onClick={() => setShowForm(true)} className="btn-primary mx-auto mt-5">
                  <span className="material-symbols-outlined text-base">add_circle_outline</span> New lesson
                </button>
              </div>
            )}
          </div>

          {/* Right: metadata */}
          <div className="col-span-12 flex flex-col gap-4 xl:col-span-3">
            <div className="rounded-xl border border-line bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">Course metadata</span>
                <span className="material-symbols-outlined text-muted">tune</span>
              </div>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-surface p-3">
                  <dt className="text-muted">Price</dt>
                  <dd className="font-semibold text-ink">{course?.price ? `${branding?.currency ?? 'USD'} ${course.price}` : 'Free'}</dd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-surface p-3">
                  <dt className="text-muted">Discount</dt>
                  <dd className="font-semibold text-ink">{course?.discount ? `${branding?.currency ?? 'USD'} ${course.discount}` : '--'}</dd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-surface p-3">
                  <dt className="text-muted">Approval</dt>
                  <dd className="font-semibold capitalize text-ink">{course?.isApproved ?? '--'}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-line bg-card p-4 shadow-sm">
              <span className="font-semibold text-ink">Completion criteria</span>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                {[
                  { on: false, label: 'Watch duration threshold', sub: 'Learner must watch at least 85% of a video' },
                  { on: true, label: 'Pass checkpoint', sub: 'Score minimum 80% on inline quiz' },
                  { on: true, label: 'Mark complete', sub: 'Every lesson marked complete' },
                ].map((item, i) => (
                  <label key={i} className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-surface p-2.5 hover:bg-surface/70">
                    <input defaultChecked={item.on} type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-[var(--brand-primary)]" />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{item.label}</span>
                      <span className="block text-xs text-muted">{item.sub}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-brand p-4 text-white shadow-md">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">bolt</span>
                <span className="font-semibold">Publish status</span>
              </div>
              <p className="mt-1 text-sm text-white/80">
                {course?.status === 'active'
                  ? 'This course is live and visible to learners.'
                  : 'This course is a draft. It will go live once an admin approves it.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonForm({
  courseId,
  chapterId,
  onDone,
  onCancel,
}: {
  courseId: number;
  chapterId?: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    storage: 'youtube',
    filePath: '',
    fileType: 'video',
    duration: '',
    isPreview: false,
    downloadable: false,
    description: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!chapterId) {
      setErr('Add a module first.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/courses/${courseId}/content/lessons`, {
        method: 'POST',
        body: JSON.stringify({ ...form, chapterId, order: 1 }),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="input !rounded-lg"
          placeholder="Lesson title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <input
          className="input !rounded-lg"
          placeholder="Duration (e.g. 8:20)"
          value={form.duration}
          onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="input !rounded-lg" value={form.storage} onChange={(e) => setForm((f) => ({ ...f, storage: e.target.value }))}>
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
          <option value="upload">Upload URL</option>
          <option value="external_link">External link</option>
        </select>
        <select className="input !rounded-lg" value={form.fileType} onChange={(e) => setForm((f) => ({ ...f, fileType: e.target.value }))}>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="pdf">PDF</option>
          <option value="doc">Doc</option>
          <option value="file">File</option>
        </select>
      </div>
      <input
        className="input !rounded-lg"
        placeholder="Video/file URL or ID"
        value={form.filePath}
        onChange={(e) => setForm((f) => ({ ...f, filePath: e.target.value }))}
      />
      <textarea
        className="input !rounded-lg"
        placeholder="Lesson description (optional)"
        rows={3}
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
      />
      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isPreview} onChange={(e) => setForm((f) => ({ ...f, isPreview: e.target.checked }))} /> Free preview
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.downloadable} onChange={(e) => setForm((f) => ({ ...f, downloadable: e.target.checked }))} /> Downloadable
        </label>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="btn-primary !rounded-lg !px-3 !py-2 text-xs">
          {busy ? 'Adding...' : 'Add lesson'}
        </button>
        <button onClick={onCancel} className="btn-ghost !rounded-lg !px-3 !py-2 text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

function LessonEditor({
  lesson,
  busy,
  onPatch,
  onSave,
}: {
  lesson: Lesson;
  busy: boolean;
  onPatch: (patch: Partial<Lesson>) => void;
  onSave: () => void;
}) {
  const typePills: { key: string; icon: string; label: string }[] = [
    { key: 'video', icon: 'videocam', label: 'Video Lecture' },
    { key: 'article', icon: 'article', label: 'Reading Material' },
    { key: 'file', icon: 'terminal', label: 'Code Sandbox' },
    { key: 'audio', icon: 'quiz', label: 'Quiz' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-line bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3">
          <label className="label">Lesson title</label>
          <input
            className="input !rounded-lg !border-0 !bg-surface !py-3 text-base font-semibold"
            value={lesson.title}
            onChange={(e) => onPatch({ title: e.target.value })}
          />

          <label className="label">Lesson type</label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {typePills.map((t) => (
              <button
                key={t.key}
                onClick={() => onPatch({ fileType: t.key === 'article' ? 'doc' : t.key })}
                className={`flex items-center justify-center gap-2 rounded-lg p-2.5 text-xs font-semibold transition ${
                  lesson.fileType === (t.key === 'article' ? 'doc' : t.key)
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-surface text-muted hover:bg-surface/70 hover:text-ink'
                }`}
              >
                <span className="material-symbols-outlined text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Storage</label>
              <select
                className="input !rounded-lg"
                value={lesson.storage || 'upload'}
                onChange={(e) => onPatch({ storage: e.target.value })}
              >
                {Object.entries(STORAGE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Duration</label>
              <input
                className="input !rounded-lg"
                value={lesson.duration}
                placeholder="e.g. 8:20"
                onChange={(e) => onPatch({ duration: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Video / file URL or ID</label>
            <input
              className="input !rounded-lg"
              value={lesson.filePath}
              onChange={(e) => onPatch({ filePath: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Lesson overview</label>
            <textarea
              className="input !rounded-lg"
              rows={4}
              value={lesson.description ?? ''}
              onChange={(e) => onPatch({ description: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={lesson.isPreview}
                onChange={(e) => onPatch({ isPreview: e.target.checked })}
                className="h-4 w-4 rounded accent-[var(--brand-primary)]"
              />{' '}
              Free preview
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={lesson.downloadable}
                onChange={(e) => onPatch({ downloadable: e.target.checked })}
                className="h-4 w-4 rounded accent-[var(--brand-primary)]"
              />{' '}
              Downloadable
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            <button onClick={onSave} disabled={busy} className="btn-primary !rounded-lg">
              <span className="material-symbols-outlined text-base">save</span>
              {busy ? 'Saving...' : 'Save lesson'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
