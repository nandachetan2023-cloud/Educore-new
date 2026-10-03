'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export interface Announcement {
  enabled: boolean;
  message: string;
  linkText: string;
  linkUrl: string;
  tone: 'brand' | 'info' | 'success' | 'warning';
}

const DISMISS_KEY = 'educore.announcementDismissed';

/** Banner colours per tone. `brand` follows the tenant's primary colour. */
const TONES: Record<Announcement['tone'], string> = {
  brand: 'bg-brand text-white',
  info: 'bg-sky-600 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-white',
};

/**
 * Site-wide promotional strip rendered above the marketing navbar. Copy comes
 * from Admin → Site content, so campaigns can be launched without a deploy.
 * A visitor who dismisses it stays dismissed for that message — the stored
 * fingerprint changes when the copy does, so editing the banner brings it
 * back for everyone.
 */
function AnnouncementBar({ announcement }: { announcement: Announcement }) {
  // Starts false so the strip is part of the server-rendered HTML — a promo
  // that only paints after hydration is both invisible to crawlers and slow to
  // show. Dismissal is applied in the effect below, which costs a brief flash
  // for someone who already closed this exact message and nothing otherwise.
  const [dismissed, setDismissed] = useState(false);

  const fingerprint = announcement.message;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === fingerprint);
  }, [fingerprint]);

  if (!announcement?.enabled || !announcement.message || dismissed) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, fingerprint);
    setDismissed(true);
  };

  const tone = TONES[announcement.tone] ?? TONES.brand;
  const internal = announcement.linkUrl.startsWith('/');

  return (
    <div className={`relative text-sm ${tone}`}>
      <div className="container-page flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 pr-9 text-center">
        <p className="font-medium">{announcement.message}</p>
        {announcement.linkText && announcement.linkUrl && (
          <Link
            href={announcement.linkUrl}
            className="shrink-0 font-semibold underline underline-offset-4 hover:no-underline"
            {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
          >
            {announcement.linkText}
          </Link>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-80 transition hover:bg-black/10 hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/**
 * Site chrome wrapper. Dashboard routes render inside their own
 * DirectoryShell (fixed sidebar + header), so the marketing Navbar and
 * Footer are hidden there — otherwise the footer slides underneath the
 * fixed sidebar and the page gets two navbars.
 */
export function Chrome({
  announcement,
  children,
}: {
  announcement?: Announcement;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare = pathname === '/dashboard' || pathname?.startsWith('/dashboard/');
  return (
    <div className="flex min-h-screen flex-col">
      {!bare && announcement && <AnnouncementBar announcement={announcement} />}
      {!bare && <Navbar />}
      <main className="flex-1">{children}</main>
      {!bare && <Footer />}
    </div>
  );
}