'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface ContactSettings {
  'contact.title'?: string;
  'contact.subtitle'?: string;
  'contact.email'?: string;
  'contact.phone'?: string;
  'contact.address'?: string;
  'contact.hours'?: string;
}

function MapPinIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 6.75Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

export default function ContactPage() {
  const [settings, setSettings] = useState<ContactSettings>({});
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Record<string, string>>('/cms/settings', { auth: false })
      .then((s) => setSettings(s as ContactSettings))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) { setErr('Please fill in all required fields.'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/contact', {
        method: 'POST',
        body: JSON.stringify(form),
        auth: false,
      });
      setSent(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to send message. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const title = settings['contact.title'] || 'Get in touch';
  const subtitle = settings['contact.subtitle'] || "Have a question or want to work with us? We'd love to hear from you.";
  const email = settings['contact.email'] || 'hello@educore.app';
  const phone = settings['contact.phone'] || '';
  const address = settings['contact.address'] || '';
  const hours = settings['contact.hours'] || 'Mon–Fri, 9 AM–6 PM';

  return (
    <div>
      {/* Page header */}
      <div className="bg-ink py-16 text-center text-white">
        <span className="badge bg-white/10 text-white/80 text-xs">Contact us</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-white/70">{subtitle}</p>
      </div>

      <div className="container-page max-w-5xl py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_380px]">

          {/* Contact form */}
          {sent ? (
            <div className="card flex flex-col items-center justify-center gap-4 p-12 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-600">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">Message sent!</h2>
              <p className="text-muted">Thanks for reaching out. We'll get back to you within 24–48 hours.</p>
              <button
                onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                className="btn-ghost mt-2 text-sm"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card space-y-5 p-8">
              <h2 className="text-xl font-bold">Send us a message</h2>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label">Your name <span className="text-red-400">*</span></label>
                  <input
                    className="input"
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Email address <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    className="input"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Subject</label>
                <input
                  className="input"
                  placeholder="How can we help?"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Message <span className="text-red-400">*</span></label>
                <textarea
                  className="input min-h-[160px] resize-none"
                  placeholder="Tell us more about your question or project…"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>

              {err && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full py-3 text-base"
              >
                {busy ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}

          {/* Contact info */}
          <div className="space-y-6">
            <div className="card p-7">
              <h3 className="mb-5 text-lg font-bold">Contact information</h3>
              <div className="space-y-5">
                <ContactRow icon={<MailIcon />} label="Email" value={email} href={`mailto:${email}`} />
                {phone && <ContactRow icon={<PhoneIcon />} label="Phone" value={phone} href={`tel:${phone}`} />}
                {address && <ContactRow icon={<MapPinIcon />} label="Address" value={address} />}
                <ContactRow icon={<ClockIcon />} label="Business hours" value={hours} />
              </div>
            </div>

            <div className="card overflow-hidden p-0">
              {/* Decorative map placeholder */}
              <div className="relative h-48 bg-gradient-to-br from-brand/10 to-accent/10">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
                  <MapPinIcon />
                  <span className="text-sm">{address || 'Find us on the map'}</span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm font-medium">We're here to help</p>
                <p className="mt-1 text-sm text-muted">Our support team responds within 24 hours on business days.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        {href ? (
          <a href={href} className="mt-0.5 text-sm text-ink hover:text-brand hover:underline">{value}</a>
        ) : (
          <p className="mt-0.5 text-sm text-ink">{value}</p>
        )}
      </div>
    </div>
  );
}
