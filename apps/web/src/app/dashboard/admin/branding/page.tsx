'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { ImageUpload } from '@/components/image-upload';
import type { Branding } from '@/lib/types';

export default function BrandingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<Branding>({
    name: '', logo: '', favicon: '', primaryColor: '#4f46e5', secondaryColor: '#0ea5e9', currency: 'USD', commissionRate: 20,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') { router.push('/login?next=/dashboard/admin/branding'); return; }
    // Branding is super-admin only; regular admins get bounced to the console.
    if (user.adminRole !== 'super_admin') { router.push('/dashboard/admin'); return; }
    api<Branding>('/branding', { auth: false }).then((b) => setForm(b)).catch(() => {}).finally(() => setLoading(false));
  }, [user, authLoading]);

  const save = async () => {
    setBusy(true); setMsg(null); setErr(null);
    try {
      await api('/admin/branding', {
        method: 'PUT',
        body: JSON.stringify({ ...form, commissionRate: String(form.commissionRate) }),
      });
      setMsg('Branding saved. Applying…');
      // Re-fetch branding everywhere: the layout fetches server-side, so a full
      // reload re-themes the whole app (logo, colors, favicon, name).
      setTimeout(() => window.location.assign('/dashboard/admin/branding'), 700);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save');
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!confirm('Reset all branding to the install defaults?')) return;
    await api('/admin/branding/reset', { method: 'PUT' });
    window.location.assign('/dashboard/admin/branding');
  };

  const set = (k: keyof Branding) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
      <h1 className="mt-3 text-3xl font-extrabold">Branding</h1>
      <p className="mt-1 text-muted">White-label the entire platform. Changes apply everywhere instantly.</p>

      {/* Live preview */}
      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          {form.logo && !form.logo.endsWith('.svg') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo} alt="" className="h-8 w-auto max-w-[160px] object-contain" />
          ) : (
            <>
              <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: form.primaryColor }}>
                {form.name?.[0] ?? 'E'}
              </span>
              <span className="font-extrabold">{form.name || 'Your Brand'}</span>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <span className="h-6 w-6 rounded-full" style={{ background: form.primaryColor }} />
            <span className="h-6 w-6 rounded-full" style={{ background: form.secondaryColor }} />
          </div>
        </div>
        <div className="px-5 py-3 text-xs text-muted">Live preview of your header</div>
      </div>

      <div className="card mt-6 space-y-6 p-6">
        <div>
          <label className="label">Company / brand name</label>
          <input className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="EduCore" />
        </div>

        <ImageUpload label="Logo (PNG/JPG — shown in header & footer)" value={form.logo} onChange={set('logo')} />
        <ImageUpload label="Favicon (browser tab icon)" value={form.favicon} onChange={set('favicon')} />

        <div className="grid gap-5 sm:grid-cols-2">
          <ColorField label="Primary color" value={form.primaryColor} onChange={set('primaryColor')} />
          <ColorField label="Secondary color" value={form.secondaryColor} onChange={set('secondaryColor')} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label">Currency</label>
            <select className="input" value={form.currency} onChange={(e) => set('currency')(e.target.value)}>
              {['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'AED', 'SGD'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Platform commission (%)</label>
            <input type="number" min="0" max="100" className="input" value={form.commissionRate}
              onChange={(e) => setForm((f) => ({ ...f, commissionRate: Number(e.target.value) }))} />
          </div>
        </div>

        {msg && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{msg}</p>}
        {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

        <div className="flex gap-3">
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save branding'}</button>
          <button onClick={reset} className="btn-ghost">Reset to defaults</button>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-card" />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
