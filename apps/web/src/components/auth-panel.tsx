'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { useBranding } from '@/lib/providers';
import { api, oauthStartUrl } from '@/lib/api';

const SIDE_IMG = 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=1000&q=80&auto=format&fit=crop';

/** Dark navy side panel from the reference login/register screens. */
export function AuthSidePanel() {
  const branding = useBranding();
  const name = branding?.name ?? 'EduCore';
  return (
    <div className="relative hidden overflow-hidden bg-[#0a1929] lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-2xl">
          <img src={SIDE_IMG} alt="" className="aspect-[4/3] w-full object-cover" />
        </div>
        <h2 className="mt-10 font-display text-4xl font-semibold leading-tight text-white">
          Master new skills with {name}.
        </h2>
        <p className="mt-4 leading-relaxed text-white/60">
          Join over 25,000 students worldwide and start your learning journey with industry experts today.
        </p>
      </div>
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface">
      <div className="container-page py-8 lg:py-12">
        <div className="grid overflow-hidden rounded-[24px] border border-line bg-card shadow-lift lg:grid-cols-2">
          <AuthSidePanel />
          <div className="flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Real social sign-in buttons. Providers are fetched from the backend —
 * unconfigured providers are hidden entirely (no dead buttons).
 * Each button is a plain link: the API 302s to Google/GitHub and back.
 */
export function SocialButtons({ role = 'student' }: { role?: 'student' | 'instructor' }) {
  const [providers, setProviders] = useState<{ google: boolean; github: boolean } | null>(null);

  useEffect(() => {
    api<{ google: boolean; github: boolean }>('/auth/oauth/providers', { auth: false })
      .then(setProviders)
      .catch(() => setProviders({ google: false, github: false }));
  }, []);

  if (!providers || (!providers.google && !providers.github)) return null;

  return (
    <>
      <div className={`grid gap-3 ${providers.google && providers.github ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {providers.google && (
        <a
          href={oauthStartUrl('google', role)}
          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card py-2.5 text-sm font-semibold text-ink transition hover:border-ink/30"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c0 1.1-.7 2.7-2.1 3.8l-.1.1 3 2.4.2.1c1.9-1.8 3-4.4 3-8.6z" /><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.1 2.4v.1C3.9 21.3 7.7 24 12 24z" /><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.1-2.4-.1.1C.7 8.9 0 10.4 0 12s.7 3.1 1.9 4.4l3.3-2z" /><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.7 0 3.9 2.7 1.9 6.6l3.3 2.6c1-2.9 3.7-4.5 6.8-4.5z" /></svg>
          Google
        </a>
      )}
      {providers.github && (
        <a
          href={oauthStartUrl('github', role)}
          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card py-2.5 text-sm font-semibold text-ink transition hover:border-ink/30"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" /></svg>
          GitHub
        </a>
      )}
      </div>
      <OrDivider />
    </>
  );
}

export function SecureBadges() {
  return (
    <div className="mt-10 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-widest text-muted/60">
      <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Secure SSL</span>
      <span className="h-1 w-1 rounded-full bg-line" />
      <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Verified Provider</span>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-4">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs font-medium text-muted">OR CONTINUE WITH EMAIL</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
