'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function PlayerPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [active, setActive] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="grid lg:grid-cols-[1fr_360px]">
      {/* Player */}
      <div className="min-h-[60vh] bg-black/95 p-4 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
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
                  <a href={active.filePath} target="_blank" rel="noreferrer" className="btn-primary">Open resource ↗</a>
                </div>
              )
            ) : (
              <div className="grid h-full place-items-center text-white/50">Select a lesson</div>
            )}
          </div>

          {active && (
            <div className="mt-5 flex items-start justify-between gap-4 text-white">
              <div>
                <h1 className="text-xl font-bold">{active.title}</h1>
                {active.description && <p className="mt-2 text-sm text-white/70">{active.description}</p>}
              </div>
              <button onClick={markComplete} className="btn-primary shrink-0">Mark complete</button>
            </div>
          )}
        </div>
      </div>

      {/* Curriculum sidebar */}
      <aside className="border-l border-line bg-card">
        <div className="border-b border-line p-5">
          <Link href="/dashboard" className="text-sm text-muted hover:text-brand">← My learning</Link>
          <h2 className="mt-2 font-bold">{player.title}</h2>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${player.progress}%` }} />
          </div>
          <div className="mt-1.5 text-xs text-muted">{player.progress}% complete</div>
          {player.progress === 100 && player.certificate && (
            <button
              onClick={() =>
                downloadFile(`/certificates/${player.id}/download`, `certificate-${player.slug}.pdf`).catch((e) =>
                  alert(e instanceof ApiError ? e.message : 'Could not generate certificate'),
                )
              }
              className="btn-primary mt-4 w-full py-2.5 text-sm"
            >
              🎓 Download certificate
            </button>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {player.chapters.map((ch) => (
            <div key={ch.id} className="border-b border-line">
              <div className="bg-surface px-5 py-3 text-sm font-semibold">{ch.title}</div>
              <ul>
                {ch.lessons.map((l) => (
                  <li key={l.id}>
                    <button
                      onClick={() => openLesson(l.id)}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition hover:bg-brand-soft/40 ${
                        active?.id === l.id ? 'bg-brand-soft' : ''
                      }`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                        l.completed ? 'border-brand bg-brand text-white' : 'border-line text-transparent'
                      }`}>✓</span>
                      <span className="flex-1">{l.title}</span>
                      <span className="text-xs text-muted">{l.duration}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
