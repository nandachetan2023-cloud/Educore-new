'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDown, ArrowLeft, ArrowUp, BarChart3, Blocks, Copy, Eye, EyeOff, HelpCircle,
  Image as ImageIcon, LayoutGrid, LayoutTemplate, Mail, Megaphone, Minus, Pencil, Play,
  Plus, Quote, Save, Settings2, Text, Trash2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { ImageUpload } from '@/components/image-upload';
import { PageBlocks } from '@/components/page-blocks';
import {
  BLOCK_DEFINITIONS, blockDefinition, coerceBlocks, createBlock, slugifyTitle,
  sitePageForSlug,
  type FieldDef, type PageBlock, type PageBlockType,
} from '@/lib/page-builder';

interface PageRecord {
  id: number;
  tenantId: number;
  title: string;
  slug: string;
  status: boolean;
  content?: string | null;
  blocks?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
}

type InspectorTab = 'section' | 'page';

const PALETTE_ICONS: Record<string, typeof LayoutTemplate> = {
  LayoutTemplate, Text, LayoutGrid, BarChart3, Image: ImageIcon, Play, Megaphone,
  HelpCircle, Quote, Mail, Minus,
};

function PaletteIcon({ name, className }: { name: string; className?: string }) {
  const Icon = PALETTE_ICONS[name] ?? Blocks;
  return <Icon className={className} />;
}

function blankItem(fields: FieldDef[]): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'select') item[field.key] = field.options?.[0]?.value ?? '';
    else if (field.type === 'boolean') item[field.key] = false;
    else item[field.key] = '';
  }
  return item;
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === 'image') {
    return (
      <ImageUpload
        label={field.label}
        value={typeof value === 'string' ? value : ''}
        onChange={(url) => onChange(url)}
      />
    );
  }

  if (field.type === 'list') {
    const items = Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : [];
    const updateItem = (index: number, key: string, next: unknown) => {
      const copy = items.map((item) => ({ ...item }));
      copy[index] = { ...copy[index], [key]: next };
      onChange(copy);
    };
    const move = (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return;
      const copy = [...items];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      onChange(copy);
    };
    const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label !mb-0">{field.label}</label>
          <span className="text-xs text-muted">{items.length}</span>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-xl border border-line bg-surface/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">
                  {field.itemLabel ?? 'Item'} {index + 1}
                </span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" title="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" title="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(index)} className="rounded p-1 text-red-500 hover:text-red-600" title="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {field.fields.map((sub) => (
                  <FieldEditor
                    key={sub.key}
                    field={sub}
                    value={item[sub.key]}
                    onChange={(next) => updateItem(index, sub.key, next)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange([...items, blankItem(field.fields)])}
          className="btn-ghost small mt-3 w-full"
        >
          <Plus className="h-3.5 w-3.5" /> {field.addLabel ?? 'Add item'}
        </button>
      </div>
    );
  }

  const textValue = value == null ? '' : String(value);
  const placeholder = 'placeholder' in field ? field.placeholder : undefined;
  return (
    <div>
      {field.type === 'boolean' ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-brand"
          />
          {field.label}
        </label>
      ) : (
        <>
          <label className="label">{field.label}</label>
          {field.type === 'textarea' ? (
            <textarea
              className="input min-h-24"
              rows={3}
              placeholder={field.placeholder}
              value={textValue}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : field.type === 'select' ? (
            <select className="input" value={textValue} onChange={(e) => onChange(e.target.value)}>
              {(field.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              type={field.type === 'number' ? 'number' : 'text'}
              placeholder={placeholder}
              value={textValue}
              onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
            />
          )}
        </>
      )}
      {field.help && <p className="mt-1 text-xs text-muted">{field.help}</p>}
    </div>
  );
}

export default function PageBuilderEditor({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new';
  const initialId = isNew ? null : Number(params.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [pageId, setPageId] = useState<number | null>(initialId);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [siteRoutePage, setSiteRoutePage] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [legacyContent, setLegacyContent] = useState('');
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>('page');
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const loadedRef = useRef(false);

  const selected = useMemo(
    () => blocks.find((block) => block.id === selectedId) ?? null,
    [blocks, selectedId],
  );
  const definition = selected ? blockDefinition(selected.type) : null;
  const urlSlug = slug || slugifyTitle(title) || 'your-page';
  const sitePage = sitePageForSlug(urlSlug);
  const publicPath = sitePage?.path ?? `/page/${urlSlug}`;

  const touch = useCallback(() => setDirty(true), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') {
      router.push(`/login?next=/dashboard/admin/settings/pages`);
      return;
    }
    if (user.adminRole !== 'super_admin') {
      router.push('/dashboard/admin');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.adminRole !== 'super_admin') return;
    api<Tenant[]>('/admin/pages/tenants')
      .then((rows) => {
        setTenants(rows);
        if (isNew) {
          const requestedTenantId = Number(searchParams.get('tenantId'));
          setTenantId(rows.some((tenant) => tenant.id === requestedTenantId)
            ? requestedTenantId
            : rows[0]?.id ?? null);
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load workspaces'));
    if (isNew) {
      setLoading(false);
      setStatus(false);
      return;
    }
    if (!Number.isFinite(initialId) || initialId === null) {
      setError('Invalid page id');
      setLoading(false);
      return;
    }
    api<PageRecord>(`/admin/pages/${initialId}`)
      .then((page) => {
        setPageId(page.id);
        setTenantId(page.tenantId);
        setTitle(page.title);
        setSlug(page.slug);
        setSiteRoutePage(Boolean(sitePageForSlug(page.slug)));
        setSlugTouched(true);
        setStatus(page.status);
        setSeoTitle(page.seoTitle ?? '');
        setSeoDescription(page.seoDescription ?? '');
        setLegacyContent(page.content ?? '');
        const nextBlocks = coerceBlocks(page.blocks);
        setBlocks(nextBlocks);
        setSelectedId(nextBlocks[0]?.id ?? null);
        setTab(nextBlocks.length ? 'section' : 'page');
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this page'))
      .finally(() => {
        setLoading(false);
        loadedRef.current = true;
      });
  }, [user, isNew, initialId, searchParams]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const changeTitle = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugifyTitle(value));
    touch();
  };

  const addBlock = (type: PageBlockType) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
    setTab('section');
    setPreview(false);
    touch();
  };

  const updateSelectedData = (key: string, value: unknown) => {
    if (!selectedId) return;
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === selectedId ? { ...block, data: { ...block.data, [key]: value } } : block,
      ),
    );
    touch();
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    touch();
  };

  const duplicateBlock = (id: string) => {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === id);
      if (index < 0) return prev;
      const source = prev[index];
      const copy = createBlock(source.type);
      copy.data = JSON.parse(JSON.stringify(source.data)) as Record<string, unknown>;
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      setSelectedId(copy.id);
      return next;
    });
    touch();
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId(null);
    touch();
  };

  const toggleHidden = (id: string) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, hidden: !block.hidden } : block)),
    );
    touch();
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Add a page title before saving.');
      setTab('page');
      return;
    }
    if (tenantId === null) {
      setError('Select a workspace before saving this page.');
      setTab('page');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || slugifyTitle(title),
        tenantId,
        status,
        seoTitle,
        seoDescription,
        blocks,
        content: legacyContent,
      };
      if (pageId) {
        await api<PageRecord>(`/admin/pages/${pageId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        const created = await api<PageRecord>('/admin/pages', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setPageId(created.id);
        setSlug(created.slug);
        setSlugTouched(true);
        router.replace(`/dashboard/admin/settings/pages/${created.id}`);
      }
      setDirty(false);
      setNotice(status ? 'Page saved and published.' : 'Draft saved.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save the page');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="container-page py-20 text-center text-muted">Loading editor…</div>;
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/dashboard/admin/settings/pages"
            className="btn-ghost small"
            onClick={(e) => {
              if (dirty && !confirm('Discard unsaved changes?')) e.preventDefault();
            }}
          >
            <ArrowLeft className="h-4 w-4" /> Pages
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{title || 'Untitled page'}</p>
            <p className="text-xs text-muted">
              {publicPath} {dirty && <span className="text-amber-600">· unsaved changes</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPreview((value) => !value)}
            className={`btn-ghost small ${preview ? 'border-brand text-brand' : ''}`}
          >
            {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {preview ? 'Edit' : 'Preview'}
          </button>
          {pageId && !publicPath.includes('[slug]') && (
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost small"
              title={status ? 'Open published page' : 'Open public page (only visible when published)'}
            >
              <Eye className="h-4 w-4" /> View live
            </a>
          )}
          <button onClick={save} disabled={saving} className="btn-primary small">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className="px-4 pt-4 sm:px-6">
          {error && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{error}</p>}
          {notice && <p className="rounded-xl bg-green-500/10 px-4 py-2.5 text-sm text-green-700">{notice}</p>}
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[230px_minmax(0,1fr)_340px]">
        {/* Palette */}
        <aside className="border-b border-line bg-card p-4 lg:sticky lg:top-[64px] lg:h-[calc(100vh-64px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Add section</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {BLOCK_DEFINITIONS.map((def) => (
              <button
                key={def.type}
                type="button"
                onClick={() => addBlock(def.type)}
                className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 p-2.5 text-left transition hover:border-brand/40 hover:bg-brand-soft/40"
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <PaletteIcon name={def.icon} className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-bold text-ink">{def.label}</span>
                  <span className="mt-0.5 hidden text-[11px] leading-snug text-muted lg:block">{def.description}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <main className="min-w-0 p-4 sm:p-6">
          {preview ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              {blocks.length > 0 ? (
                <PageBlocks blocks={blocks.map((block) => ({ ...block, hidden: false }))} />
              ) : legacyContent ? (
                <div className="rich-text p-8" dangerouslySetInnerHTML={{ __html: legacyContent }} />
              ) : (
                <div className="p-16 text-center text-sm text-muted">Nothing to preview yet.</div>
              )}
            </div>
          ) : blocks.length === 0 ? (
            <div className="grid min-h-[420px] place-items-center rounded-2xl border-2 border-dashed border-line bg-card p-8 text-center">
              <div>
                <Blocks className="mx-auto h-10 w-10 text-muted" />
                <h2 className="mt-3 font-display text-2xl font-semibold">Build your page</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Add sections from the left. Each section is fully editable and can be reordered or hidden.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => addBlock('hero')} className="btn-primary small">
                    <Plus className="h-4 w-4" /> Start with a hero
                  </button>
                  <button type="button" onClick={() => setTab('page')} className="btn-ghost small">
                    <Settings2 className="h-4 w-4" /> Page settings
                  </button>
                </div>
                {legacyContent && (
                  <p className="mx-auto mt-5 max-w-md rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-700">
                    This page has legacy HTML content. It stays as a fallback until you add the first section.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((block, index) => {
                const def = blockDefinition(block.type);
                const active = selectedId === block.id && tab === 'section';
                return (
                  <div
                    key={block.id}
                    className={`group relative overflow-hidden rounded-2xl border bg-white transition ${
                      active ? 'border-brand ring-2 ring-brand/20' : 'border-line hover:border-brand/30'
                    } ${block.hidden ? 'opacity-60' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(block.id);
                        setTab('section');
                      }}
                      className="absolute inset-0 z-10 cursor-pointer"
                      aria-label={`Edit ${def.label} section`}
                    />
                    <div className="relative z-20 flex items-center justify-between border-b border-line bg-card px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-soft text-brand">
                          <PaletteIcon name={def.icon} className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-bold text-ink">{def.label}</span>
                        {block.hidden && <span className="badge bg-line text-muted">Hidden</span>}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={index === 0} className="rounded p-1.5 text-muted hover:bg-surface hover:text-ink disabled:opacity-30" title="Move up">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => moveBlock(block.id, 1)} disabled={index === blocks.length - 1} className="rounded p-1.5 text-muted hover:bg-surface hover:text-ink disabled:opacity-30" title="Move down">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => duplicateBlock(block.id)} className="rounded p-1.5 text-muted hover:bg-surface hover:text-ink" title="Duplicate">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => toggleHidden(block.id)} className="rounded p-1.5 text-muted hover:bg-surface hover:text-ink" title={block.hidden ? 'Show section' : 'Hide section'}>
                          {block.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => removeBlock(block.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Delete section">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="pointer-events-none max-h-[440px] overflow-hidden">
                      {block.hidden ? (
                        <div className="p-10 text-center text-sm text-muted">Hidden section — not shown on the public page.</div>
                      ) : (
                        <PageBlocks blocks={[block]} />
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => addBlock('richText')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-muted transition hover:border-brand/40 hover:text-brand"
              >
                <Plus className="h-4 w-4" /> Add another section
              </button>
            </div>
          )}
        </main>

        {/* Inspector */}
        <aside className="border-t border-line bg-card p-4 lg:sticky lg:top-[64px] lg:h-[calc(100vh-64px)] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setTab('section')}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === 'section' ? 'bg-brand text-white' : 'text-muted'}`}
            >
              Section
            </button>
            <button
              type="button"
              onClick={() => setTab('page')}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === 'page' ? 'bg-brand text-white' : 'text-muted'}`}
            >
              Page
            </button>
          </div>

          {tab === 'section' ? (
            selected && definition ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-bold text-ink">{definition.label}</p>
                  <p className="text-xs text-muted">{definition.description}</p>
                </div>
                {definition.fields.map((field) => (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    value={selected.data[field.key]}
                    onChange={(value) => updateSelectedData(field.key, value)}
                  />
                ))}
                <div className="border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() => duplicateBlock(selected.id)}
                    className="btn-ghost small mr-2"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(selected.id)}
                    className="btn-ghost small text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-10 text-center text-sm text-muted">
                <Blocks className="mx-auto h-8 w-8" />
                <p className="mt-3">Select a section on the canvas to edit it.</p>
              </div>
            )
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">Workspace</label>
                <select
                  className="input"
                  value={tenantId ?? ''}
                  onChange={(event) => {
                    setTenantId(Number(event.target.value) || null);
                    touch();
                  }}
                  disabled={tenants.length === 0}
                >
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                  ))}
                </select>
                {tenants.length === 0 && (
                  <p className="mt-1 text-xs text-red-500">No workspaces are available for this page.</p>
                )}
              </div>
              <div>
                <label className="label">Page title</label>
                <input className="input" value={title} onChange={(e) => changeTitle(e.target.value)} placeholder="About us" />
              </div>
              <div>
                <label className="label">Slug</label>
                <div className="flex items-center rounded-xl border border-line bg-surface px-3">
                  <span className="text-xs text-muted">{siteRoutePage ? 'Route key' : '/page/'}</span>
                  <input
                    className="w-full bg-transparent py-2.5 text-sm text-ink outline-none"
                    value={slug}
                    disabled={siteRoutePage}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugifyTitle(e.target.value));
                      touch();
                    }}
                    placeholder="about"
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {siteRoutePage
                    ? `This key connects the page to ${sitePage?.path ?? 'its storefront route'} and cannot be changed.`
                    : 'Lowercase letters, numbers and hyphens. Must be unique.'}
                </p>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-ink">Published</span>
                  <span className="block text-xs text-muted">Visible to anyone with the link.</span>
                </span>
                <input
                  type="checkbox"
                  checked={status}
                  onChange={(e) => {
                    setStatus(e.target.checked);
                    touch();
                  }}
                  className="h-5 w-5 accent-[rgb(var(--brand-primary))]"
                />
              </label>
              <div>
                <label className="label">SEO title</label>
                <input
                  className="input"
                  maxLength={70}
                  value={seoTitle}
                  onChange={(e) => {
                    setSeoTitle(e.target.value);
                    touch();
                  }}
                  placeholder={title || 'About us'}
                />
                <p className="mt-1 text-right text-[11px] text-muted">{seoTitle.length}/70</p>
              </div>
              <div>
                <label className="label">SEO description</label>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={170}
                  value={seoDescription}
                  onChange={(e) => {
                    setSeoDescription(e.target.value);
                    touch();
                  }}
                  placeholder="A short summary for search results."
                />
                <p className="mt-1 text-right text-[11px] text-muted">{seoDescription.length}/170</p>
              </div>
              <details className="rounded-xl border border-line p-3" open={Boolean(legacyContent) && blocks.length === 0}>
                <summary className="cursor-pointer text-sm font-semibold text-ink">Legacy HTML fallback</summary>
                <p className="mt-2 text-xs text-muted">
                  Only used when the page has no sections. The block layout replaces this content.
                </p>
                <textarea
                  className="input mt-2 min-h-32 font-mono text-xs"
                  value={legacyContent}
                  onChange={(e) => {
                    setLegacyContent(e.target.value);
                    touch();
                  }}
                  placeholder="<p>Optional HTML</p>"
                />
              </details>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
