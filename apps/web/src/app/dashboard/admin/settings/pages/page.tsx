'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight, Blocks, Copy, FileText, Pencil, Plus, Search, Trash2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SITE_PAGE_TEMPLATES, sitePageForSlug } from '@/lib/page-builder';

interface CustomPage {
  id: number;
  tenantId: number;
  title: string;
  slug: string;
  status: boolean;
  blockCount: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  updatedAt: string;
  createdAt: string;
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
}

type Filter = 'all' | 'published' | 'draft';

export default function PageBuilderPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creatingSitePages, setCreatingSitePages] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pageRows, tenantRows] = await Promise.all([
        api<CustomPage[]>('/admin/pages'),
        api<Tenant[]>('/admin/pages/tenants'),
      ]);
      setPages(pageRows);
      setTenants(tenantRows);
      setSelectedTenantId((current) => current ?? tenantRows[0]?.id ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') {
      router.push('/login?next=/dashboard/admin/settings/pages');
      return;
    }
    if (user.adminRole !== 'super_admin') {
      router.push('/dashboard/admin');
      return;
    }
    load();
  }, [user, authLoading, load, router]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return pages.filter((page) => {
      if (page.tenantId !== selectedTenantId) return false;
      if (filter === 'published' && !page.status) return false;
      if (filter === 'draft' && page.status) return false;
      if (!term) return true;
      return page.title.toLowerCase().includes(term) || page.slug.toLowerCase().includes(term);
    });
  }, [pages, query, filter, selectedTenantId]);

  const addMissingSitePages = async () => {
    if (selectedTenantId === null) {
      setError('Create or select a workspace before adding site pages.');
      return;
    }
    const existing = new Set(
      pages.filter((page) => page.tenantId === selectedTenantId).map((page) => page.slug),
    );
    const missing = SITE_PAGE_TEMPLATES.filter((template) => !existing.has(template.slug));
    if (missing.length === 0) {
      setNotice('All standard site pages are already in the builder.');
      return;
    }

    setCreatingSitePages(true);
    setError(null);
    try {
      await Promise.all(missing.map((template) => api('/admin/pages', {
        method: 'POST',
        body: JSON.stringify({
          title: template.title,
          slug: template.slug,
          tenantId: selectedTenantId,
          status: false,
          blocks: [],
        }),
      })));
      setNotice(`Added ${missing.length} standard site pages as drafts.`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add standard site pages');
      await load();
    } finally {
      setCreatingSitePages(false);
    }
  };

  const duplicate = async (page: CustomPage) => {
    setBusyId(page.id);
    setError(null);
    try {
      const copy = await api<CustomPage>(`/admin/pages/${page.id}/duplicate`, { method: 'POST' });
      setNotice(`Created “${copy.title}” as a draft.`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to duplicate page');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (page: CustomPage) => {
    if (!confirm(`Delete “${page.title}”? This cannot be undone.`)) return;
    setBusyId(page.id);
    setError(null);
    try {
      await api(`/admin/pages/${page.id}`, { method: 'DELETE' });
      setNotice('Page deleted.');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete page');
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || loading) {
    return <div className="container-page py-20 text-center text-muted">Loading…</div>;
  }

  return (
    <div className="container-page max-w-5xl py-10">
      <Link href="/dashboard/admin/settings" className="text-sm text-muted hover:text-brand">← Settings</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Page builder</h1>
          <p className="mt-1 max-w-xl text-muted">
            Compose custom pages or add sections to standard storefront routes without replacing their existing features.
          </p>
        </div>
        <Link href={`/dashboard/admin/settings/pages/new${selectedTenantId ? `?tenantId=${selectedTenantId}` : ''}`} className="btn-primary">
          <Plus className="h-4 w-4" /> New page
        </Link>
      </div>

      {error && <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{error}</p>}
      {notice && <p className="mt-5 rounded-xl bg-green-500/10 px-4 py-2.5 text-sm text-green-700">{notice}</p>}

      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-bold text-ink">Standard site pages</h2>
            <p className="mt-1 text-sm text-muted">
              Add editable sections to the storefront routes while keeping their existing forms and features intact.
            </p>
          </div>
          <button
            type="button"
            onClick={addMissingSitePages}
            disabled={creatingSitePages || selectedTenantId === null}
            className="btn-primary small"
          >
            <Plus className="h-4 w-4" />
            {creatingSitePages ? 'Adding pages…' : 'Add missing pages'}
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SITE_PAGE_TEMPLATES.map((template) => {
            const page = pages.find(
              (item) => item.tenantId === selectedTenantId && item.slug === template.slug,
            );
            return (
              <div key={template.slug} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{template.title}</p>
                  <p className="truncate text-xs text-muted">{template.path}</p>
                </div>
                {page ? (
                  <Link href={`/dashboard/admin/settings/pages/${page.id}`} className="btn-ghost small shrink-0">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs text-muted">Not added</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Workspace
          <select
            className="input min-w-48"
            value={selectedTenantId ?? ''}
            onChange={(event) => setSelectedTenantId(Number(event.target.value) || null)}
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-1 rounded-full border border-line bg-card p-1">
          {(['all', 'published', 'draft'] as Filter[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                filter === key ? 'bg-brand text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        <label className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages…"
            className="input pl-9"
            style={{ paddingLeft: '2.25rem' }}
          />
        </label>
      </div>

      <div className="card mt-5 divide-y divide-line">
        {visible.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-semibold">
              {pages.length === 0 ? 'No custom pages yet' : 'No pages match this filter'}
            </p>
            <p className="mt-1 text-sm text-muted">
              {pages.length === 0
                ? 'Create About, Terms, Privacy or any other page your learners need.'
                : 'Try a different search or status filter.'}
            </p>
            {pages.length === 0 && (
              <Link
                href={`/dashboard/admin/settings/pages/new${selectedTenantId ? `?tenantId=${selectedTenantId}` : ''}`}
                className="btn-primary mt-5"
              >
                <Plus className="h-4 w-4" /> Create your first page
              </Link>
            )}
          </div>
        ) : (
          visible.map((page) => (
            <div key={page.id} className="flex flex-wrap items-center gap-4 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Blocks className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{page.title}</span>
                  <span className={`badge ${page.status ? '' : 'bg-line text-muted'}`}>
                    {page.status ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {sitePageForSlug(page.slug)?.path ?? `/page/${page.slug}`} · {page.blockCount} {page.blockCount === 1 ? 'section' : 'sections'} · updated{' '}
                  {new Date(page.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {page.status && !sitePageForSlug(page.slug)?.path.includes('[slug]') && (
                  <a
                    href={sitePageForSlug(page.slug)?.path ?? `/page/${page.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost small"
                    title="View published page"
                  >
                    <ArrowUpRight className="h-4 w-4" /> View
                  </a>
                )}
                <Link href={`/dashboard/admin/settings/pages/${page.id}`} className="btn-ghost small">
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
                <button
                  onClick={() => duplicate(page)}
                  disabled={busyId === page.id}
                  className="btn-ghost small"
                  title="Duplicate page"
                >
                  <Copy className="h-4 w-4" /> Duplicate
                </button>
                <button
                  onClick={() => remove(page)}
                  disabled={busyId === page.id}
                  className="btn-ghost small text-red-500 hover:text-red-600"
                  title="Delete page"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
