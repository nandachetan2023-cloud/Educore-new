'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Download, FileText, MessageCircle,
  Pause, Play, Search, Sparkles, Trophy,
} from 'lucide-react';
import { api, downloadFile, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

interface PLesson { id: number; title: string; duration: string; fileType: string; completed: boolean; isPreview: boolean }
interface PChapter { id: number; title: string; lessons: PLesson[] }
interface Player { id: number; title: string; slug: string; chapters: PChapter[]; progress: number; certificate?: boolean }
interface LessonContent {
  id: number; title: string; description?: string; filePath: string; storage: string; fileType: string;
  downloadable: boolean; resumeAt: number; completed: boolean;
}

/** How often (ms) to checkpoint video position to the server while playing. */
const PROGRESS_SAVE_INTERVAL_MS = 5000;
/** Auto-mark a lesson complete once watched past this fraction of its length. */
const AUTO_COMPLETE_THRESHOLD = 0.9;

function embedUrl(storage: string, filePath: string): string {
  if (storage === 'youtube') {
    const id = filePath.split(/v=|\/|be\//).pop();
    return `https://www.youtube.com/embed/${id}`;
  }
  if (storage === 'vimeo') {
    const id = filePath.split('/').pop();
    return `https://player.vimeo.com/video/${id}`;
  }
  return filePath;
}

type Tab = 'curriculum' | 'notes' | 'ask';

export default function PlayerPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [active, setActive] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('curriculum');
  const [lessonFilter, setLessonFilter] = useState('');
  const [openChapters, setOpenChapters] = useState<Set<number>>(new Set([0]));
  const [note, setNote] = useState('');
  const [askQuery, setAskQuery] = useState('');
  const lastSaveRef = useRef(0);
  const autoCompletedRef = useRef(false);

  const loadPlayer = useCallback(async () => {
    const p = await api<Player>(`/learn/${slug}`);
    setPlayer(p);
    return p;
  }, [slug]);

  const openLesson = useCallback(async (lessonId: number) => {
    const content = await api<LessonContent>(`/learn/lesson/${lessonId}`);
    setActive(content);
    autoCompletedRef.current = content.completed;
    try {
      const saved = localStorage.getItem(`educore.note.${lessonId}`);
      setNote(saved ?? '');
    } catch { setNote(''); }
    api(`/learn/lesson/${lessonId}/watch`, { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(`/login?next=/learn/${slug}`); return; }
    loadPlayer()
      .then((p) => {
        const first = p.chapters.flatMap((c) => c.lessons)[0];
        if (first) return openLesson(first.id);
      })
      .catch(() => setPlayer(null))
      .finally(() => setLoading(false));
  }, [user, authLoading, slug]);

  const markComplete = async () => {
    if (!active) return;
    autoCompletedRef.current = true;
    await api(`/learn/lesson/${active.id}/complete`, { method: 'POST' });
    await loadPlayer();
  };

  const completeAndNext = async () => {
    if (!active || !player) return;
    await markComplete();
    const flat = player.chapters.flatMap((c) => c.lessons);
    const idx = flat.findIndex((l) => l.id === active.id);
    const next = flat[idx + 1];
    if (next) await openLesson(next.id);
  };

  const saveNote = () => {
    if (!active) return;
    try {
      localStorage.setItem(`educore.note.${active.id}`, note);
    } catch { /* storage unavailable */ }
  };

  // Throttled resume-position checkpoint + auto-complete near the end of playback.
  const onVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!active) return;
    const video = e.currentTarget;
    const now = Date.now();
    if (now - lastSaveRef.current >= PROGRESS_SAVE_INTERVAL_MS) {
      lastSaveRef.current = now;
      api(`/learn/lesson/${active.id}/progress`, {
        method: 'POST',
        body: JSON.stringify({ seconds: Math.floor(video.currentTime) }),
      }).catch(() => {});
    }
    if (!autoCompletedRef.current && video.duration && video.currentTime / video.duration >= AUTO_COMPLETE_THRESHOLD) {
      autoCompletedRef.current = true;
      markComplete();
    }
  };

  const onVideoEnded = () => {
    if (!autoCompletedRef.current) markComplete();
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;
  if (!player) return <div className="container-page py-20 text-center text-muted">Course unavailable.</div>;

  const allLessons = player.chapters.flatMap((c) => c.lessons);
  const doneCount = allLessons.filter((l) => l.completed || (active && l.id === active.id && autoCompletedRef.current)).length;
  const activeChapterIdx = player.chapters.findIndex((c) => c.lessons.some((l) => l.id === active?.id));
  const takeaways = active?.description ? active.description.split('. ').map((s) => s.trim()).filter(Boolean).slice(0, 3) : [];
  const askResults = askQuery.trim()
    ? allLessons.filter((l) => l.title.toLowerCase().includes(askQuery.trim().toLowerCase())).slice(0, 6)
    : [];
  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'ask', label: 'Ask AI', icon: MessageCircle },
  ];

  return (
    <div className="bg-surface">
      <div className="container-page py-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-muted hover:text-brand">
            <ArrowLeft className="h-4 w-4" /> Back to Course Dashboard
          </Link>
          <div className="flex rounded-full border border-line bg-card p-1 shadow-sm">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                  tab === t.id ? 'bg-ink text-white shadow' : 'text-muted hover:text-ink'
                }`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ── Player column ── */}
          <div className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-lift">
              {active ? (
                active.storage === 'youtube' || active.storage === 'vimeo' ? (
                  <iframe src={embedUrl(active.storage, active.filePath)} className="h-full w-full" allowFullScreen title={active.title} />
                ) : active.fileType === 'video' ? (
                  <video
                    key={active.id}
                    src={active.filePath}
                    controls
                    className="h-full w-full"
                    onLoadedMetadata={(e) => {
                      if (active.resumeAt > 0) e.currentTarget.currentTime = active.resumeAt;
                    }}
                    onTimeUpdate={onVideoTimeUpdate}
                    onEnded={onVideoEnded}
                  />
                ) : (
                  <div className="grid h-full place-items-center text-white/70">
                    <a href={active.filePath} target="_blank" rel="noreferrer" className="btn-primary rounded-full">Open resource ↗</a>
                  </div>
                )
              ) : (
                <div className="grid h-full place-items-center text-white/50">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-brand text-white"><Pause className="h-6 w-6 fill-current" /></span>
                </div>
              )}
            </div>

            {active && (
              <>
                <p className="mt-5 text-[13px] font-medium text-muted">
                  <span className="rounded-full bg-green-500/10 px-2.5 py-1 font-bold text-green-600">
                    Module {String(Math.max(1, activeChapterIdx + 1)).padStart(2, '0')}
                  </span>
                  <span className="ml-2">· {doneCount} of {allLessons.length} lessons completed</span>
                </p>
                <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                  <h1 className="max-w-xl font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                    {active.title}
                  </h1>
                  <div className="flex shrink-0 gap-2">
                    {active.downloadable && (
                      <a href={active.filePath} download className="btn-ghost rounded-xl text-sm">
                        <Download className="h-4 w-4" /> Resources
                      </a>
                    )}
                    <button onClick={completeAndNext} className="btn-primary rounded-xl text-sm">
                      Complete & Next <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_300px]">
                  <div>
                    <h2 className="text-lg font-bold text-ink">About this lesson</h2>
                    <p className="mt-2 leading-relaxed text-muted">
                      {active.description ?? 'Work through this lesson, then mark it complete to advance your progress.'}
                    </p>
                    {takeaways.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-soft text-[11px] text-brand">i</span>
                          Key Takeaways:
                        </h3>
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
                          {takeaways.map((t, i) => <li key={i}>{t.endsWith('.') ? t : `${t}.`}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Trophy className="h-4 w-4 text-amber-500" /> Your Progress</h3>
                      <div className="mt-2.5 flex items-center justify-between text-sm">
                        <span className="text-muted">Course Completion</span>
                        <span className="font-bold text-ink">{player.progress}%</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand to-green-500" style={{ width: `${player.progress}%` }} />
                      </div>
                      <p className="mt-2 text-center text-xs text-muted">
                        {player.progress >= 100 ? 'Course complete — certificate unlocked!' : 'Complete all lessons to unlock your certificate!'}
                      </p>
                      {player.progress === 100 && player.certificate && (
                        <button
                          onClick={() =>
                            downloadFile(`/certificates/${player.id}/download`, `certificate-${player.slug}.pdf`).catch((e) =>
                              alert(e instanceof ApiError ? e.message : 'Could not generate certificate'),
                            )
                          }
                          className="btn-primary mt-3 w-full rounded-xl py-2.5 text-sm"
                        >
                          🎓 Download certificate
                        </button>
                      )}
                    </div>

                    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-ink">Course Links</h3>
                      <div className="mt-2 space-y-1 text-sm">
                        <Link href={`/courses/${player.slug}`} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-muted transition hover:bg-surface hover:text-brand">
                          <BookOpen className="h-4 w-4" /> Course overview page
                        </Link>
                        <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-muted transition hover:bg-surface hover:text-brand">
                          <Play className="h-4 w-4" /> My learning dashboard
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Side panel ── */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {tab === 'curriculum' && (
              <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
                <div className="border-b border-line p-4">
                  <label className="relative flex items-center">
                    <Search className="absolute left-3.5 h-4 w-4 text-muted" />
                    <input
                      value={lessonFilter}
                      onChange={(e) => setLessonFilter(e.target.value)}
                      placeholder="Search lessons..."
                      className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </label>
                </div>
                <div className="max-h-[64vh] space-y-3 overflow-y-auto p-4">
                  {player.chapters.map((ch, ci) => {
                    const lessons = ch.lessons.filter((l) => l.title.toLowerCase().includes(lessonFilter.toLowerCase()));
                    if (lessonFilter && lessons.length === 0) return null;
                    const open = openChapters.has(ci);
                    return (
                      <div key={ch.id} className="overflow-hidden rounded-xl border border-line">
                        <button
                          onClick={() => setOpenChapters((prev) => {
                            const next = new Set(prev);
                            if (next.has(ci)) next.delete(ci);
                            else next.add(ci);
                            return next;
                          })}
                          className="flex w-full items-center justify-between gap-2 bg-surface px-4 py-3 text-left"
                        >
                          <span>
                            <span className="block text-sm font-bold text-ink">{ch.title}</span>
                            <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">
                              {ch.lessons.length} lessons · 45 min
                            </span>
                          </span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                          <ul className="space-y-1 p-2">
                            {lessons.map((l) => {
                              const isActive = l.id === active?.id;
                              return (
                                <li key={l.id}>
                                  <button
                                    onClick={() => openLesson(l.id)}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                                      isActive ? 'bg-brand-soft font-semibold text-brand' : 'hover:bg-surface'
                                    }`}
                                  >
                                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                                      l.completed ? 'border-green-500 bg-green-500 text-white' : 'border-line text-transparent'
                                    }`}>
                                      <Check className="h-3 w-3" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className={`block truncate ${isActive ? '' : 'text-ink/80'}`}>{l.title}</span>
                                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                                        <span className="rounded border border-line px-1.5 py-px font-semibold">VIDEO</span>
                                        <span>◷ {l.duration}</span>
                                      </span>
                                    </span>
                                    {isActive && <Play className="h-4 w-4 shrink-0 fill-current" />}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'notes' && (
              <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><FileText className="h-4 w-4 text-brand" /> Lesson notes</h3>
                <p className="mt-1 text-[13px] text-muted">
                  {active ? `Notes for "${active.title}" are saved in this browser.` : 'Select a lesson to take notes.'}
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={saveNote}
                  rows={10}
                  disabled={!active}
                  placeholder="Write your key takeaways here…"
                  className="input mt-3 min-h-[240px] resize-y leading-relaxed"
                />
                <button onClick={saveNote} disabled={!active} className="btn-primary mt-3 w-full rounded-xl py-2.5 text-sm">
                  Save note
                </button>
              </div>
            )}

            {tab === 'ask' && (
              <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Sparkles className="h-4 w-4 text-brand" /> Ask about this course</h3>
                <p className="mt-1 text-[13px] text-muted">Search the curriculum to jump straight to the lesson you need.</p>
                <label className="relative mt-3 flex items-center">
                  <Search className="absolute left-3.5 h-4 w-4 text-muted" />
                  <input
                    value={askQuery}
                    onChange={(e) => setAskQuery(e.target.value)}
                    placeholder="e.g. authentication, hooks…"
                    className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </label>
                <div className="mt-3 space-y-1.5">
                  {askQuery.trim() === '' ? (
                    <p className="rounded-xl bg-surface px-4 py-3 text-[13px] text-muted">
                      Tip: complete lessons in order — each module builds on the previous one.
                    </p>
                  ) : askResults.length === 0 ? (
                    <p className="rounded-xl bg-surface px-4 py-3 text-[13px] text-muted">No lessons match “{askQuery}”.</p>
                  ) : (
                    askResults.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => { openLesson(l.id); setTab('curriculum'); }}
                        className="flex w-full items-center justify-between gap-2 rounded-xl bg-surface px-4 py-2.5 text-left text-sm transition hover:bg-brand-soft"
                      >
                        <span className="truncate font-medium text-ink">{l.title}</span>
                        <span className="shrink-0 text-xs text-muted">{l.duration}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
