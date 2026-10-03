'use client';

import Link from 'next/link';
import { Facebook, Github, Instagram, Linkedin, Twitter } from 'lucide-react';
import { useBranding } from '@/lib/providers';
import { BrandMark, BrandName } from '@/components/ui';

export function Footer() {
  const branding = useBranding();
  const year = new Date().getFullYear();
  const name = branding?.name ?? 'EduCore';

  return (
    <footer className="border-t border-line bg-[#f4f5f7]">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        {/* Brand */}
        <div>
          <Link href="/" className="flex items-center gap-2">
            <BrandMark />
            <BrandName className="text-[19px] font-extrabold tracking-tight text-ink" />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Empowering learners worldwide with premium quality courses and a seamless, modern learning experience.
          </p>
        </div>

        <FooterCol
          title="Platform"
          links={[
            ['Courses', '/courses'],
            ['Become an instructor', '/become-instructor'],
            ['Blog', '/blog'],
            ['Support', '/contact'],
          ]}
        />

        <FooterCol
          title="Company"
          links={[
            ['About Us', '/page/about'],
            ['Terms of Service', '/page/terms'],
            ['Privacy Policy', '/page/privacy'],
          ]}
        />

        <div>
          <h4 className="mb-4 text-[15px] font-bold text-ink">Connect</h4>
          <div className="flex items-center gap-4 text-muted">
            <a href="#" aria-label="Twitter" className="transition hover:text-brand"><Twitter className="h-5 w-5" strokeWidth={1.75} /></a>
            <a href="#" aria-label="Facebook" className="transition hover:text-brand"><Facebook className="h-5 w-5" strokeWidth={1.75} /></a>
            <a href="#" aria-label="Instagram" className="transition hover:text-brand"><Instagram className="h-5 w-5" strokeWidth={1.75} /></a>
            <a href="#" aria-label="LinkedIn" className="transition hover:text-brand"><Linkedin className="h-5 w-5" strokeWidth={1.75} /></a>
            <a href="#" aria-label="GitHub" className="transition hover:text-brand"><Github className="h-5 w-5" strokeWidth={1.75} /></a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-[13px] text-muted">
          <span>© {year} {name}. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/page/privacy" className="transition hover:text-ink">Privacy Policy</Link>
            <Link href="/page/terms" className="transition hover:text-ink">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-4 text-[15px] font-bold text-ink">{title}</h4>
      <ul className="space-y-3">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-muted transition hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
