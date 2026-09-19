'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';

interface ContactSettings {
  title: string;
  subtitle: string;
  email: string;
  phone: string;
  address: string;
  hours: string;
}

const DEFAULTS: ContactSettings = {
  title: 'Get in touch',
  subtitle: "Have a question or want to work with us? We'd love to hear from you.",
  email: 'hello@educore.app',
  phone: '',
  address: '',
  hours: 'Mon–Fri, 9 AM–6 PM',
};

const FIELD_LABELS: Record<keyof ContactSettings, string> = {
  title: 'Page title',
  subtitle: 'Subtitle / description',
  email: 'Contact email address',
  phone: 'Phone number',
  address: 'Physical address',
  hours: 'Business hours',
};

const FIELD_PLACEHOLDERS: Record<keyof ContactSettings, string> = {
  title: 'Get in touch',
  subtitle: "Have a question? We'd love to hear from you.",
  email: 'hello@example.com',
  phone: '+1 (555) 000-0000',
  address: '123 Main St, City, Country',
  hours: 'Mon–Fri, 9 AM–6 PM',
};

export default function ContactSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [fields, setFields] = useState<ContactSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/settings/contact'); return; }
    if (user.adminRole !== 'super_admin') { router.push('/dashboard/admin'); return; }

    api<Record<string, string>>('/cms/settings', { auth: false })
      .then((s) => {
        setFields({
          title: s['contact.title'] ?? DEFAULTS.title,
          subtitle: s['contact.subtitle'] ?? DEFAULTS.subtitle,
          email: s['contact.email'] ?? DEFAULTS.email,
          phone: s['contact.phone'] ?? DEFAULTS.phone,
          address: s['contact.address'] ?? DEFAULTS.address,
          hours: s['contact.hours'] ?? DEFAULTS.hours,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const save = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      await Promise.all(
        (Object.keys(fields) as (keyof ContactSettings)[]).map((k) =>
          api(`/cms/settings/contact.${k}`, {
            method: 'PUT',
            body: JSON.stringify({ value: fields[k] }),
          }),
        ),
      );
      setMsg('Contact page settings saved successfully.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save settings.');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) {
    return <div className="container-page py-20 text-center text-muted">Loading…</div>;
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <Link href="/dashboard/admin/settings" className="text-sm text-muted hover:text-brand">
        ← Settings
      </Link>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Contact page</h1>
          <p className="mt-1 text-muted">Edit the content and contact details shown on the public contact page.</p>
        </div>
        <a href="/contact" target="_blank" rel="noreferrer" className="btn-ghost text-sm">
          Preview →
        </a>
      </div>

      {msg && <p className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{msg}</p>}
      {err && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}

      <div className="card mt-6 space-y-5 p-7">
        <h2 className="font-semibold text-ink">Page content</h2>
        {(['title', 'subtitle'] as const).map((key) => (
          <div key={key}>
            <label className="label">{FIELD_LABELS[key]}</label>
            {key === 'subtitle' ? (
              <textarea
                className="input"
                rows={2}
                placeholder={FIELD_PLACEHOLDERS[key]}
                value={fields[key]}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              />
            ) : (
              <input
                className="input"
                placeholder={FIELD_PLACEHOLDERS[key]}
                value={fields[key]}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <div className="card mt-4 space-y-5 p-7">
        <h2 className="font-semibold text-ink">Contact details</h2>
        {(['email', 'phone', 'address', 'hours'] as const).map((key) => (
          <div key={key}>
            <label className="label">{FIELD_LABELS[key]}</label>
            {key === 'address' ? (
              <textarea
                className="input"
                rows={2}
                placeholder={FIELD_PLACEHOLDERS[key]}
                value={fields[key]}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              />
            ) : (
              <input
                className="input"
                type={key === 'email' ? 'email' : 'text'}
                placeholder={FIELD_PLACEHOLDERS[key]}
                value={fields[key]}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <a href="/contact" target="_blank" rel="noreferrer" className="btn-ghost">
          Preview contact page
        </a>
      </div>
    </div>
  );
}
