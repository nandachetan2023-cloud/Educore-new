'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Eye, EyeOff, Layers, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, tokenStore, API_BASE } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { ImageUpload } from '@/components/image-upload';

type Token = 'studentName' | 'courseTitle' | 'instructorName' | 'date' | 'brandName' | 'custom';

const TOKEN_LABEL: Record<Token, string> = {
  studentName: 'Student name',
  courseTitle: 'Course title',
  instructorName: 'Instructor name',
  date: 'Date',
  brandName: 'Brand name',
  custom: 'Custom text',
};

/** Realistic sample values used by the on-canvas preview toggle. */
const SAMPLE_TEXT: Record<Token, string> = {
  studentName: 'Jane Cooper',
  courseTitle: 'Intro to Digital Design',
  instructorName: 'Prof. Alex Morgan',
  date: 'October 31, 2026',
  brandName: 'EduCore Academy',
  custom: 'Custom text',
};

interface Item {
  id?: number;
  elementId: Token;
  xPosition: string;
  yPosition: string;
  text?: string;
  fontSize: number;
  color: string;
  bold: boolean;
}

interface Builder {
  id: number;
  background?: string | null;
  title?: string | null;
  subTitle?: string | null;
  description?: string | null;
  signature?: string | null;
}

interface TemplateSummary {
  index: number;
  name: string;
  builder: Pick<Builder, 'title' | 'subTitle' | 'description'>;
  items: Item[];
  preview?: string;
}

// A4 landscape aspect ratio, matching the PDF page pdfkit generates.
const ASPECT = 842 / 595;

/** Magnetic distance (in %) within which a dragged element snaps to the center. */
const SNAP = 2;

export default function CertificateBuilderPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [builder, setBuilder] = useState<Builder>({ id: 0 });
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<number | null>(null); // index into items
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(true); // show sample values instead of {{tokens}}
  const [guides, setGuides] = useState(false); // center alignment guides while dragging
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('[]');

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  // Wizard: step 1 = pick one of the 10 sample templates, step 2 = customize.
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [wizardStep, setWizardStep] = useState<1 | 2 | null>(null);
  const [wizardBusy, setWizardBusy] = useState<number | null>(null);
  const [appliedStyle, setAppliedStyle] = useState<string | null>(null); // preset chosen, drives Preview PDF

  const snapshot = useMemo(() => JSON.stringify({ builder, items }), [builder, items]);
  const dirty = snapshot !== baseline;

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/settings/certificate'); return; }
    // allow admin and super_admin to use the builder
    
    api<{ builder: Builder; items: Item[] }>('/admin/certificate-builder')
      .then((d) => {
        setBuilder(d.builder);
        setItems(d.items);
        setBaseline(JSON.stringify({ builder: d.builder, items: d.items }));
        setWizardStep(d.items.length === 0 ? 1 : null); // empty layout → start the wizard at step 1
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    api<TemplateSummary[]>('/admin/certificate-builder/templates')
      .then(setTemplates)
      .catch(() => {});
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Positions new elements in a loose stagger down the middle so they don't pile up. */
  const nextSpot = (count: number) => {
    const row = count % 5;
    return { x: 46 + row * 2, y: 30 + Math.floor(count / 5) * 6 };
  };

  const addItem = (elementId: Token) => {
    const spot = nextSpot(items.length);
    const item: Item = {
      elementId,
      xPosition: String(spot.x),
      yPosition: String(spot.y),
      fontSize: 16,
      color: '#111827',
      bold: false,
      text: elementId === 'custom' ? 'Custom text' : undefined,
    };
    setItems((its) => [...its, item]);
    setSelected(items.length);
  };

  const duplicateSelected = () => {
    if (selected === null) return;
    const src = items[selected];
    const copy = { ...src, xPosition: String(Number(src.xPosition) + 3), yPosition: String(Number(src.yPosition) + 3) };
    setItems((its) => [...its, copy]);
    setSelected(items.length); // the new copy ends up on top
  };

  const bringToFront = () => {
    if (selected === null) return;
    setItems((its) => [...its.filter((_, i) => i !== selected), items[selected!]]);
  };

  const removeItem = (index: number) => {
    setItems((its) => its.filter((_, i) => i !== index));
    setSelected(null);
  };

  const clearAll = () => {
    if (items.length === 0) return;
    if (!window.confirm('Remove all placeholders from the canvas? This cannot be undone unless you save first.')) return;
    setItems([]);
    setSelected(null);
  };

  /** Wizard: apply one of the built-in templates, replacing the current layout. */
  const applyTemplate = async (tpl: TemplateSummary) => {
    if (items.length > 0 && !window.confirm(`Apply "${tpl.name}"? This replaces your current certificate layout (must be saved to be undoable).`)) return;
    setWizardBusy(tpl.index); setMsg(null); setErr(null);
    try {
      await api(`/admin/certificate-builder/templates/${tpl.index}/apply`, { method: 'PUT' });
      const d = await api<{ builder: Builder; items: Item[] }>('/admin/certificate-builder');
      setBuilder(d.builder);
      setItems(d.items);
      setBaseline(JSON.stringify({ builder: d.builder, items: d.items }));
      setSelected(null);
      setWizardStep(null);
      setAppliedStyle(tpl.name);
      setMsg(`Template "${tpl.name}" applied. Customize it, then press Save to publish.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to apply template');
    } finally {
      setWizardBusy(null);
    }
  };

  const updateSelected = (patch: Partial<Item>) => {
    if (selected === null) return;
    setItems((its) => its.map((it, i) => (i === selected ? { ...it, ...patch } : it)));
  };

  const clamp = (v: number) => Math.min(100, Math.max(0, v));

  const onPointerDown = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(index);
    dragging.current = index;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current === null || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    // Magnetic center guides: near the middle the element locks on.
    const snapX = Math.abs(rawX - 50) < SNAP ? 50 : rawX;
    const snapY = Math.abs(rawY - 50) < SNAP ? 50 : rawY;
    setGuides(Math.abs(rawX - 50) < SNAP || Math.abs(rawY - 50) < SNAP);
    setItems((its) =>
      its.map((it, i) =>
        i === dragging.current
          ? { ...it, xPosition: clamp(snapX).toFixed(1), yPosition: clamp(snapY).toFixed(1) }
          : it,
      ),
    );
  };

  const onPointerUp = () => {
    dragging.current = null;
    setGuides(false);
  };

  // Keyboard: arrows nudge (Shift = bigger steps), Delete removes, Ctrl/Cmd+D
  // duplicates the selection. Ignored while typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (selected === null) return;
      const it = items[selected];
      if (!it) return;
      const step = e.shiftKey ? 2 : 0.5;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeItem(selected);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        updateSelected({ xPosition: clamp(Number(it.xPosition) - step).toFixed(1) });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        updateSelected({ xPosition: clamp(Number(it.xPosition) + step).toFixed(1) });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateSelected({ yPosition: clamp(Number(it.yPosition) - step).toFixed(1) });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateSelected({ yPosition: clamp(Number(it.yPosition) + step).toFixed(1) });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, items]);

  const save = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      await api('/admin/certificate-builder', {
        method: 'PUT',
        body: JSON.stringify({
          background: builder.background,
          title: builder.title,
          subTitle: builder.subTitle,
          description: builder.description,
          signature: builder.signature,
        }),
      });
      const itemsRes = await api<Item[]>('/admin/certificate-builder/items', { method: 'PUT', body: JSON.stringify({ items }) });
      setItems(itemsRes);
      setBaseline(JSON.stringify({ builder, items: itemsRes }));
      setMsg('Certificate layout saved. Every certificate issued from now on will use it.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    try {
      const style = appliedStyle ? `?style=${encodeURIComponent(appliedStyle)}` : '';
      const res = await fetch(`${API_BASE}/admin/certificate-builder/preview${style}`, {
        headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : undefined,
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      if (blob.size === 0) { setErr('Add at least one element to the canvas before previewing.'); return; }
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      setErr('Could not generate preview');
    }
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const selectedItem = selected !== null ? items[selected] : null;

  return (
    <div className="container-page max-w-6xl py-10">
      <Link href="/dashboard/admin/settings" className="text-sm text-muted hover:text-brand">← Settings</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Certificate builder</h1>
          <p className="mt-1 text-muted">
            Drag placeholders onto the certificate, style them, and save — the PDF students download follows this layout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWizardStep(1)} className="btn-ghost">Templates</button>
          <button onClick={preview} className="btn-ghost">Preview PDF</button>
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : dirty ? 'Save ●' : 'Save'}
          </button>
        </div>
      </div>

      {wizardStep === 1 && (
        <div className="card mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Step 1 of 2 — Choose a certificate template</h2>
              <p className="mt-1 text-sm text-muted">Pick one of the 10 sample styles to prefill the builder; you can customize everything in the next step.</p>
            </div>
            {items.length > 0 && (
              <button onClick={() => setWizardStep(null)} className="btn-ghost text-sm">Skip</button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {templates.map((tpl) => (
              <button
                key={tpl.index}
                onClick={() => applyTemplate(tpl)}
                disabled={wizardBusy !== null}
                className="group card flex flex-col p-0 text-left transition hover:border-brand/50 disabled:opacity-60"
              >
                <span
                  className="block h-24 rounded-t-xl border-b border-line"
                  style={{ background: tpl.preview || 'linear-gradient(135deg,#f8fafc,#eef2ff)' }}
                >
                  <span className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
                    <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted">EduCore academy</span>
                    <span className="truncate text-xs font-bold text-ink">{tpl.builder.title}</span>
                    <span className="line-clamp-1 text-[10px] text-muted">{tpl.items.length} elements</span>
                  </span>
                </span>
                <span className="flex flex-1 items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate text-sm font-semibold">{tpl.name}</span>
                  {wizardBusy === tpl.index ? <span className="text-xs text-muted">Applying…</span> : <span className="text-xs text-brand opacity-0 group-hover:opacity-100">Use →</span>}
                </span>
              </button>
            ))}
            {templates.length === 0 && <p className="col-span-full text-sm text-muted">Templates could not be loaded — the API may still be starting.</p>}
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 border-brand/40 bg-brand-soft/30 p-4">
          <p className="text-sm font-semibold">Step 2 of 2 — Customize your layout, then press <b>Save</b>.</p>
          <button onClick={() => setWizardStep(1)} className="btn-ghost text-sm">← Back to templates</button>
        </div>
      )}

      {dirty && <p className="mt-2 text-xs font-semibold text-amber-600">You have unsaved changes — they are lost if you reload before pressing Save.</p>}

      {msg && <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{msg}</p>}
      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TOKEN_LABEL) as Token[]).map((t) => (
                <button key={t} onClick={() => addItem(t)} className="btn-ghost gap-1 px-3 py-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> {TOKEN_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSample((s) => !s)} className="btn-ghost gap-1 px-3 py-1.5 text-xs">
                {sample ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {sample ? 'Showing sample data' : 'Showing placeholders'}
              </button>
              {items.length > 0 && (
                <button onClick={clearAll} className="btn-ghost gap-1 px-3 py-1.5 text-xs text-red-500">
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>
          </div>

          <div
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative w-full select-none overflow-hidden rounded-xl border-2 border-line bg-white shadow-card"
            style={{
              aspectRatio: `${ASPECT}`,
              backgroundImage: builder.background ? `url(${builder.background})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            onPointerDownCapture={(e) => {
              if (e.target === canvasRef.current) setSelected(null);
            }}
          >
            {!builder.background && <div className="absolute inset-3 rounded-lg border-2 border-brand/60" />}

            {/* Center alignment guides, shown while an element is near the middle. */}
            {guides && (
              <>
                <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-brand/40" />
                <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-brand/40" />
              </>
            )}

            {items.length === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="rounded-xl bg-surface/90 px-6 py-4 text-center text-sm text-muted">
                  <p className="font-semibold text-ink">Empty canvas</p>
                  <p className="mt-1">Add a placeholder with the buttons above — e.g. <b>Student name</b>.</p>
                </div>
              </div>
            )}

            {items.map((it, i) => (
              <div
                key={i}
                onPointerDown={onPointerDown(i)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move whitespace-nowrap rounded px-1.5 py-0.5 ring-offset-1 ${
                  selected === i ? 'ring-2 ring-brand bg-brand-soft' : 'hover:bg-brand-soft/40'
                }`}
                style={{
                  left: `${it.xPosition}%`,
                  top: `${it.yPosition}%`,
                  fontSize: Math.min(28, it.fontSize),
                  color: it.color,
                  fontWeight: it.bold ? 700 : 400,
                }}
              >
                {it.elementId === 'custom'
                  ? it.text || 'Custom text'
                  : sample
                    ? SAMPLE_TEXT[it.elementId]
                    : `{{${TOKEN_LABEL[it.elementId]}}}`}
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-muted">
            Drag elements to move them — they snap to the exact center for symmetric layouts. Select one and use
            <kbd className="mx-1 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px]">← ↑ → ↓</kbd> to nudge
            (<kbd className="mx-1 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px]">Shift</kbd> = bigger),
            <kbd className="mx-1 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px]">Del</kbd> to remove,
            <kbd className="mx-1 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px]">Ctrl+D</kbd> to duplicate.
          </p>
        </div>

        <div className="space-y-6">
          {selectedItem ? (
            <div className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-semibold">{TOKEN_LABEL[selectedItem.elementId]}</h3>
                <div className="flex shrink-0 gap-1">
                  <button onClick={bringToFront} title="Bring to front" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-brand">
                    <Layers className="h-4 w-4" />
                  </button>
                  <button onClick={duplicateSelected} title="Duplicate (Ctrl+D)" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-brand">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeItem(selected!)} title="Remove (Del)" className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {selectedItem.elementId === 'custom' && (
                <div className="mt-3">
                  <label className="label">Text</label>
                  <input className="input" value={selectedItem.text ?? ''} onChange={(e) => updateSelected({ text: e.target.value })} />
                </div>
              )}
              <p className="mt-3 text-xs text-muted">Position: x {Number(selectedItem.xPosition).toFixed(1)}% · y {Number(selectedItem.yPosition).toFixed(1)}%</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Font size</label>
                  <input type="number" min={6} max={56} className="input" value={selectedItem.fontSize} onChange={(e) => updateSelected({ fontSize: Math.min(56, Math.max(6, Number(e.target.value))) })} />
                </div>
                <div>
                  <label className="label">Color</label>
                  <input type="color" className="h-11 w-full cursor-pointer rounded-lg border border-line bg-card" value={selectedItem.color} onChange={(e) => updateSelected({ color: e.target.value })} />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedItem.bold} onChange={(e) => updateSelected({ bold: e.target.checked })} /> Bold
              </label>
            </div>
          ) : (
            <div className="card p-5 text-sm text-muted">
              <p>Click an element on the canvas to edit its style, or add new placeholders above.</p>
              <p className="mt-2 text-xs">Tip: switch to “showing placeholders” (the eye button) to see the raw tokens exactly as they act in the PDF.</p>
            </div>
          )}

          <div className="card space-y-4 p-5">
            <h3 className="font-semibold">Certificate content</h3>
            <div>
              <label className="label">Title</label>
              <input className="input" placeholder="Certificate of Completion" value={builder.title ?? ''} onChange={(e) => setBuilder((b) => ({ ...b, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Subtitle</label>
              <input className="input" placeholder="This is proudly presented to" value={builder.subTitle ?? ''} onChange={(e) => setBuilder((b) => ({ ...b, subTitle: e.target.value }))} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={builder.description ?? ''} onChange={(e) => setBuilder((b) => ({ ...b, description: e.target.value }))} />
            </div>
            <ImageUpload label="Background image" value={builder.background ?? undefined} onChange={(url) => setBuilder((b) => ({ ...b, background: url }))} />
            <ImageUpload label="Signature image" value={builder.signature ?? undefined} onChange={(url) => setBuilder((b) => ({ ...b, signature: url }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
