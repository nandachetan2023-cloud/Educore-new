'use client';

import Link from 'next/link';
import { useBranding } from '@/lib/providers';

function TwitterIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function Footer() {
  const branding = useBranding();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-white/70">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        {/* Brand column — takes 2 cols on lg */}
        <div className="lg:col-span-2">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-white">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white text-base">
              {branding?.name?.[0] ?? 'E'}
            </span>
            {branding?.name ?? 'EduCore'}
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            Build in-demand skills with expert-led online courses. Learn at your own pace, earn certificates, and advance your career.
          </p>
          {/* Socials */}
          <div className="mt-6 flex items-center gap-3">
            <a href="#" aria-label="Twitter" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white">
              <TwitterIcon />
            </a>
            <a href="#" aria-label="LinkedIn" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white">
              <LinkedInIcon />
            </a>
            <a href="#" aria-label="YouTube" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white">
              <YoutubeIcon />
            </a>
          </div>
        </div>

        <FooterCol title="Learn" links={[
          ['All courses', '/courses'],
          ['Browse categories', '/#categories'],
          ['My learning', '/dashboard'],
          ['Student dashboard', '/dashboard'],
        ]} />

        <FooterCol title="Teach" links={[
          ['Become an instructor', '/become-instructor'],
          ['Instructor dashboard', '/dashboard/instructor'],
          ['Manage payouts', '/dashboard/instructor/payouts'],
        ]} />

        <FooterCol title="Company" links={[
          ['About us', '/page/about'],
          ['Contact us', '/contact'],
          ['Blog', '/blog'],
          ['Terms of service', '/page/terms'],
          ['Privacy policy', '/page/privacy'],
        ]} />
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10 py-6">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 text-xs text-white/40">
          <span>© {year} {branding?.name ?? 'EduCore'}. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/page/terms" className="transition hover:text-white/70">Terms</Link>
            <Link href="/page/privacy" className="transition hover:text-white/70">Privacy</Link>
            <Link href="/contact" className="transition hover:text-white/70">Contact</Link>
            <Link href="/blog" className="transition hover:text-white/70">Blog</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-semibold text-white">{title}</h4>
      <ul className="space-y-2.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-white/55 transition hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
