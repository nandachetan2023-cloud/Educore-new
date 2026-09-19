'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, tokenStore } from '@/lib/api';
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

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
// A4 landscape aspect ratio, matching the PDF page pdfkit generates.
const ASPECT = 842 / 595;

export default function CertificateBuilderPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [builder, setBuilder] = useState<Builder>({ id: 0 });
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<number | null>(null); // index into items
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/settings/certificate'); return; }
    if (user.adminRole !== 'super_admin') { router.push('/dashboard/admin'); return; }
    api<{ builder: Builder; items: Item[] }>('/admin/certificate-builder')
      .then((d) => { setBuilder(d.builder); setItems(d.items); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const addItem = (elementId: Token) => {
    setItems((its) => [
      ...its,
      { elementId, xPosition: '50', yPosition: '50', fontSize: 16, color: '#111827', bold: false, text: elementId === 'custom' ? 'Custom text' : undefined },
    ]);
    setSelected(items.length);
  };

  const updateSelected = (patch: Partial<Item>) => {
    if (selected === null) return;
    setItems((its) => its.map((it, i) => (i === selected ? { ...it, ...patch } : it)));
  };

  const removeSelected = () => {
    if (selected === null) return;
    setItems((its) => its.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const onPointerDown = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(index);
    dragging.current = index;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current === null || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    const idx = dragging.current;
    setItems((its) => its.map((it, i) => (i === idx ? { ...it, xPosition: x.toFixed(1), yPosition: y.toFixed(1) } : it)));
  };

  const onPointerUp = () => {
    dragging.current = null;
  };

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
      await api('/admin/certificate-builder/items', { method: 'PUT', body: JSON.stringify({ items }) });
      setMsg('Certificate layout saved. It will be used for every certificate issued from now on.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    try {
      const res = await fetch(`${BASE}/admin/certificate-builder/preview`, {
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
      <div className="mt-3 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Certificate builder</h1>
          <p className="mt-1 text-muted">Drag placeholders onto the canvas to design the certificate PDF students download.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={preview} className="btn-ghost">Preview PDF</button>
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      {msg && <p className="mt-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{msg}</p>}
      {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(TOKEN_LABEL) as Token[]).map((t) => (
              <button key={t} onClick={() => addItem(t)} className="btn-ghost px-3 py-1.5 text-xs">
                + {TOKEN_LABEL[t]}
              </button>
            ))}
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
            {!builder.background && (
              <div className="absolute inset-3 rounded-lg border-2 border-brand/60" />
            )}
            {items.map((it, i) => (
              <div
                key={i}
                onPointerDown={onPointerDown(i)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move whitespace-nowrap rounded px-1.5 py-0.5 ${
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
                {it.elementId === 'custom' ? (it.text || 'Custom text') : `{{${TOKEN_LABEL[it.elementId]}}}`}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Drag any placeholder to reposition it. Click to select and edit.</p>
        </div>

        <div className="space-y-6">
          {selectedItem ? (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{TOKEN_LABEL[selectedItem.elementId]}</h3>
                <button onClick={removeSelected} className="text-sm text-red-500 hover:underline">Remove</button>
              </div>
              {selectedItem.elementId === 'custom' && (
                <div className="mt-3">
                  <label className="label">Text</label>
                  <input className="input" value={selectedItem.text ?? ''} onChange={(e) => updateSelected({ text: e.target.value })} />
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Font size</label>
                  <input type="number" min={6} className="input" value={selectedItem.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
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
            <div className="card p-5 text-sm text-muted">Select or add an element to edit its style.</div>
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
