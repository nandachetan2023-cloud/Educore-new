'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

type Tab = 'home' | 'blog' | 'contact';

export default function AdminContentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('home');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') router.push('/login?next=/dashboard/admin/content');
  }, [user, authLoading]);

  if (authLoading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'home', label: 'Homepage' },
    { key: 'blog', label: 'Blog' },
    { key: 'contact', label: 'Contact Us' },
  ];

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Site content</h1>
      <p className="mt-1 text-muted">Edit the homepage, publish blog posts, and manage the contact page.</p>

      <div className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'home' && <HomeEditor />}
        {tab === 'blog' && <BlogEditor />}
        {tab === 'contact' && <ContactEditor />}
      </div>
    </div>
  );
}

/* ─── Homepage editor ─────────────────────────────────────────────────────── */
function HomeEditor() {
  const [hero, setHero] = useState({ title: '', subTitle: '', image: '' });
  const [features, setFeatures] = useState<any[]>([]);
  const [feat, setFeat] = useState({ icon: '', title: '', description: '' });
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [testi, setTesti] = useState({ name: '', headline: '', image: '', comment: '', rating: 5 });
  const [counters, setCounters] = useState<any[]>([]);
  const [counter, setCounter] = useState({ title: '', number: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api<any>('/cms/home', { auth: false }).then((h) => {
      if (h.hero) setHero({ title: h.hero.title ?? '', subTitle: h.hero.subTitle ?? '', image: h.hero.image ?? '' });
      setFeatures(h.features ?? []);
      setTestimonials(h.testimonials ?? []);
      setCounters(h.counters ?? []);
    }).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const saveHero = async () => {
    try { await api('/cms/hero', { method: 'PUT', body: JSON.stringify(hero) }); flash('Hero saved.'); }
    catch (e) { flash(e instanceof ApiError ? e.message : 'Failed'); }
  };
  const addFeature = async () => {
    if (!feat.title) return;
    await api('/cms/features', { method: 'POST', body: JSON.stringify(feat) });
    setFeat({ icon: '', title: '', description: '' }); load();
  };
  const delFeature = async (id: number) => { await api(`/cms/features/${id}`, { method: 'DELETE' }); load(); };

  const addTestimonial = async () => {
    if (!testi.name || !testi.comment) return;
    await api('/cms/testimonials', { method: 'POST', body: JSON.stringify(testi) });
    setTesti({ name: '', headline: '', image: '', comment: '', rating: 5 }); load();
  };
  const delTestimonial = async (id: number) => { await api(`/cms/testimonials/${id}`, { method: 'DELETE' }); load(); };

  const addCounter = async () => {
    if (!counter.title || !counter.number) return;
    await api('/cms/counters', { method: 'POST', body: JSON.stringify(counter) });
    setCounter({ title: '', number: '' }); load();
  };
  const delCounter = async (id: number) => { await api(`/cms/counters/${id}`, { method: 'DELETE' }); load(); };

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-xl bg-brand-soft px-4 py-2.5 text-sm font-medium text-brand">{msg}</p>}

      {/* Hero */}
      <section className="card p-6">
        <h2 className="font-bold">Hero section</h2>
        <p className="mt-0.5 text-sm text-muted">Text displayed over the homepage carousel.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Headline</label>
            <input className="input" placeholder="Learn without limits" value={hero.title} onChange={(e) => setHero((h) => ({ ...h, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Subtitle</label>
            <textarea className="input" rows={2} placeholder="Build in-demand skills…" value={hero.subTitle} onChange={(e) => setHero((h) => ({ ...h, subTitle: e.target.value }))} />
          </div>
          <button onClick={saveHero} className="btn-primary">Save hero</button>
        </div>
      </section>

      {/* Stats / counters */}
      <section className="card p-6">
        <h2 className="font-bold">Stats band</h2>
        <p className="mt-0.5 text-sm text-muted">Big numbers shown in the colored band (e.g. "200K+ Students").</p>
        <div className="mt-4 divide-y divide-line">
          {counters.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
              <span><b className="text-brand">{c.number}</b> — {c.title}</span>
              <button onClick={() => delCounter(c.id)} className="text-red-500 hover:underline">Delete</button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input className="input" placeholder="Number (e.g. 200K+)" value={counter.number} onChange={(e) => setCounter((c) => ({ ...c, number: e.target.value }))} />
          <input className="input" placeholder="Label (e.g. Students)" value={counter.title} onChange={(e) => setCounter((c) => ({ ...c, title: e.target.value }))} />
          <button onClick={addCounter} className="btn-ghost shrink-0">+ Add</button>
        </div>
      </section>

      {/* Features */}
      <section className="card p-6">
        <h2 className="font-bold">Why us — feature cards</h2>
        <p className="mt-0.5 text-sm text-muted">Shown in the "Everything you need to succeed" section.</p>
        <div className="mt-4 divide-y divide-line">
          {features.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2.5 text-sm">
              <span><b>{f.title}</b>{f.description ? ` — ${f.description}` : ''}</span>
              <button onClick={() => delFeature(f.id)} className="text-red-500 hover:underline">Delete</button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <input className="input" placeholder="Icon URL (optional)" value={feat.icon} onChange={(e) => setFeat((f) => ({ ...f, icon: e.target.value }))} />
          <input className="input" placeholder="Title" value={feat.title} onChange={(e) => setFeat((f) => ({ ...f, title: e.target.value }))} />
          <input className="input" placeholder="Description" value={feat.description} onChange={(e) => setFeat((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <button onClick={addFeature} className="btn-ghost mt-3">+ Add feature</button>
      </section>

      {/* Testimonials */}
      <section className="card p-6">
        <h2 className="font-bold">Student testimonials</h2>
        <p className="mt-0.5 text-sm text-muted">Reviews shown in the "What our students say" section.</p>
        <div className="mt-4 divide-y divide-line">
          {testimonials.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2.5 text-sm">
              <span><b>{t.name}</b> — "{t.comment?.slice(0, 60)}{(t.comment?.length ?? 0) > 60 ? '…' : ''}"</span>
              <button onClick={() => delTestimonial(t.id)} className="text-red-500 hover:underline">Delete</button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input className="input" placeholder="Name" value={testi.name} onChange={(e) => setTesti((t) => ({ ...t, name: e.target.value }))} />
          <input className="input" placeholder="Headline (e.g. Web Developer)" value={testi.headline} onChange={(e) => setTesti((t) => ({ ...t, headline: e.target.value }))} />
          <input className="input" placeholder="Avatar URL (optional)" value={testi.image} onChange={(e) => setTesti((t) => ({ ...t, image: e.target.value }))} />
          <select className="input" value={testi.rating} onChange={(e) => setTesti((t) => ({ ...t, rating: Number(e.target.value) }))}>
            {[5, 4, 3].map((r) => <option key={r} value={r}>{r} stars</option>)}
          </select>
          <textarea className="input sm:col-span-2" rows={2} placeholder="Review text" value={testi.comment} onChange={(e) => setTesti((t) => ({ ...t, comment: e.target.value }))} />
        </div>
        <button onClick={addTestimonial} className="btn-ghost mt-3">+ Add testimonial</button>
      </section>
    </div>
  );
}

/* ─── Blog editor ─────────────────────────────────────────────────────────── */
function BlogEditor() {
  const [posts, setPosts] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', shortDescription: '', description: '', image: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ data: any[] }>('/blog', { auth: false }).then((r) => setPosts(r.data)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const create = async () => {
    if (!form.title || !form.description) { flash('Title and body are required.'); return; }
    try {
      await api('/blog', { method: 'POST', body: JSON.stringify({ ...form, status: true }) });
      setForm({ title: '', shortDescription: '', description: '', image: '' });
      flash('Post published.'); load();
    } catch (e) { flash(e instanceof ApiError ? e.message : 'Failed'); }
  };
  const del = async (id: number) => { await api(`/blog/${id}`, { method: 'DELETE' }); load(); };

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-xl bg-brand-soft px-4 py-2.5 text-sm font-medium text-brand">{msg}</p>}

      <section className="card p-6">
        <h2 className="font-bold">New blog post</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="How to become a better developer" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Cover image URL</label>
            <input className="input" placeholder="https://…" value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} />
          </div>
          <div>
            <label className="label">Short description</label>
            <textarea className="input" rows={2} placeholder="A brief summary shown on the blog listing page." value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} />
          </div>
          <div>
            <label className="label">Body (HTML allowed)</label>
            <textarea className="input min-h-[200px] font-mono text-sm" rows={8} placeholder="<p>Your post content…</p>" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <button onClick={create} className="btn-primary">Publish post</button>
        </div>
      </section>

      <section>
        <h2 className="font-bold">Published posts ({posts.length})</h2>
        <div className="mt-3 space-y-2">
          {posts.length === 0 && <p className="text-sm text-muted">No posts yet.</p>}
          {posts.map((p) => (
            <div key={p.id} className="card flex items-center justify-between px-5 py-3.5">
              <div>
                <Link href={`/blog/${p.slug}`} target="_blank" className="font-medium hover:text-brand">{p.title}</Link>
                {p.shortDescription && <p className="mt-0.5 text-xs text-muted line-clamp-1">{p.shortDescription}</p>}
              </div>
              <button onClick={() => del(p.id)} className="ml-4 shrink-0 text-sm text-red-500 hover:underline">Delete</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── Contact Us editor ───────────────────────────────────────────────────── */
const CONTACT_KEYS = ['title', 'subtitle', 'email', 'phone', 'address', 'hours'] as const;
type ContactKey = (typeof CONTACT_KEYS)[number];

const CONTACT_LABELS: Record<ContactKey, string> = {
  title: 'Page title',
  subtitle: 'Subtitle / description',
  email: 'Contact email address',
  phone: 'Phone number',
  address: 'Physical address',
  hours: 'Business hours',
};

const CONTACT_PLACEHOLDERS: Record<ContactKey, string> = {
  title: 'Get in touch',
  subtitle: "Have a question? We'd love to hear from you.",
  email: 'hello@example.com',
  phone: '+1 (555) 000-0000',
  address: '123 Main St, City, Country',
  hours: 'Mon–Fri, 9 AM–6 PM',
};

const CONTACT_DEFAULTS: Record<ContactKey, string> = {
  title: 'Get in touch',
  subtitle: "Have a question or want to work with us? We'd love to hear from you.",
  email: 'hello@educore.app',
  phone: '',
  address: '',
  hours: 'Mon–Fri, 9 AM–6 PM',
};

function ContactEditor() {
  const [fields, setFields] = useState<Record<ContactKey, string>>(CONTACT_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Record<string, string>>('/cms/settings', { auth: false })
      .then((s) => {
        setFields({
          title: s['contact.title'] ?? CONTACT_DEFAULTS.title,
          subtitle: s['contact.subtitle'] ?? CONTACT_DEFAULTS.subtitle,
          email: s['contact.email'] ?? CONTACT_DEFAULTS.email,
          phone: s['contact.phone'] ?? CONTACT_DEFAULTS.phone,
          address: s['contact.address'] ?? CONTACT_DEFAULTS.address,
          hours: s['contact.hours'] ?? CONTACT_DEFAULTS.hours,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      await Promise.all(
        CONTACT_KEYS.map((k) =>
          api(`/cms/settings/contact.${k}`, {
            method: 'PUT',
            body: JSON.stringify({ value: fields[k] }),
          }),
        ),
      );
      setMsg('Contact page saved successfully.');
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-xl bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">{msg}</p>}
      {err && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{err}</p>}

      {/* Page text */}
      <section className="card p-6">
        <h2 className="font-bold">Page heading</h2>
        <p className="mt-0.5 text-sm text-muted">Shown at the top of the /contact page.</p>
        <div className="mt-4 space-y-3">
          {(['title', 'subtitle'] as ContactKey[]).map((k) => (
            <div key={k}>
              <label className="label">{CONTACT_LABELS[k]}</label>
              {k === 'subtitle' ? (
                <textarea
                  className="input"
                  rows={2}
                  placeholder={CONTACT_PLACEHOLDERS[k]}
                  value={fields[k]}
                  onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}
                />
              ) : (
                <input
                  className="input"
                  placeholder={CONTACT_PLACEHOLDERS[k]}
                  value={fields[k]}
                  onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Contact details */}
      <section className="card p-6">
        <h2 className="font-bold">Contact details</h2>
        <p className="mt-0.5 text-sm text-muted">Shown in the info sidebar on the contact page.</p>
        <div className="mt-4 space-y-3">
          {(['email', 'phone', 'address', 'hours'] as ContactKey[]).map((k) => (
            <div key={k}>
              <label className="label">{CONTACT_LABELS[k]}</label>
              {k === 'address' ? (
                <textarea
                  className="input"
                  rows={2}
                  placeholder={CONTACT_PLACEHOLDERS[k]}
                  value={fields[k]}
                  onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}
                />
              ) : (
                <input
                  className="input"
                  type={k === 'email' ? 'email' : 'text'}
                  placeholder={CONTACT_PLACEHOLDERS[k]}
                  value={fields[k]}
                  onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Preview notice */}
      <div className="rounded-xl border border-line bg-surface px-5 py-4 text-sm text-muted">
        Changes appear live on{' '}
        <a href="/contact" target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
          /contact
        </a>{' '}
        after saving.
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary px-6">
          {busy ? 'Saving…' : 'Save contact page'}
        </button>
        <a href="/contact" target="_blank" rel="noreferrer" className="btn-ghost text-sm">
          Preview →
        </a>
      </div>
    </div>
  );
}
