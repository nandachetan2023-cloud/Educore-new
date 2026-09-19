'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useBranding } from '@/lib/providers';

function SearchIcon() {
  return (
    <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

export function Navbar() {
  const branding = useBranding();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  const dashHref =
    user?.principal === 'instructor'
      ? '/dashboard/instructor'
      : user?.principal === 'admin'
        ? '/dashboard/admin'
        : '/dashboard';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/courses?search=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-card/95 shadow-sm backdrop-blur-lg">
      <nav className="container-page flex h-[68px] items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight">
          {branding?.logo && !branding.logo.endsWith('.svg') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt={branding.name} className="h-8 w-auto max-w-[140px] object-contain" />
          ) : (
            <>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white text-base">
                {branding?.name?.[0] ?? 'E'}
              </span>
              <span className="hidden sm:block">{branding?.name ?? 'EduCore'}</span>
            </>
          )}
        </Link>

        {/* Links */}
        <div className="hidden items-center gap-7 lg:flex">
          <Link href="/courses" className="text-sm font-medium text-muted hover:text-brand transition-colors">Courses</Link>
          <Link href="/#categories" className="text-sm font-medium text-muted hover:text-brand transition-colors">Categories</Link>
          <Link href="/become-instructor" className="text-sm font-medium text-muted hover:text-brand transition-colors">Teach</Link>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mx-auto hidden max-w-sm flex-1 md:block lg:max-w-md">
          <label className="relative flex items-center">
            <span className="absolute left-3.5"><SearchIcon /></span>
            <input
              type="search"
              placeholder="Search for courses…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </label>
        </form>

        {/* Actions */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/cart" aria-label="Cart" className="btn-ghost px-3 py-2.5">
            <CartIcon />
          </Link>
          {user ? (
            <>
              <Link href={dashHref} className="btn-ghost py-2 text-sm">Dashboard</Link>
              <button onClick={logout} className="btn-primary py-2 text-sm">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost py-2 text-sm">Log in</Link>
              <Link href="/register" className="btn-primary py-2 text-sm">Get started</Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="ml-auto rounded-lg p-2 text-muted hover:bg-surface hover:text-ink md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <MenuIcon open={open} />
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-card px-4 pb-5 pt-4 md:hidden">
          {/* Mobile search */}
          <form onSubmit={handleSearch} className="mb-4">
            <label className="relative flex items-center">
              <span className="absolute left-3.5"><SearchIcon /></span>
              <input
                type="search"
                placeholder="Search for courses…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none"
              />
            </label>
          </form>
          <div className="flex flex-col gap-1">
            <Link href="/courses" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>Courses</Link>
            <Link href="/#categories" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>Categories</Link>
            <Link href="/become-instructor" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>Teach</Link>
            <Link href="/cart" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>Cart</Link>
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              {user ? (
                <>
                  <Link href={dashHref} className="btn-ghost justify-start text-sm" onClick={() => setOpen(false)}>Dashboard</Link>
                  <button className="btn-primary text-sm" onClick={logout}>Sign out</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost text-sm" onClick={() => setOpen(false)}>Log in</Link>
                  <Link href="/register" className="btn-primary text-sm" onClick={() => setOpen(false)}>Get started</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
