'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronDown, Menu, Search, ShoppingCart, X } from 'lucide-react';
import { useAuth } from '@/lib/providers';
import { BrandMark, BrandName } from '@/components/ui';

export function Navbar() {
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
    if (query.trim()) {
      router.push(`/courses?search=${encodeURIComponent(query.trim())}`);
      setOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
      <nav className="container-page flex h-[68px] items-center gap-5">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <BrandMark />
          <BrandName className="text-[19px] font-extrabold tracking-tight text-ink" />
        </Link>

        {/* Links */}
        <div className="hidden items-center gap-6 lg:flex">
          <Link href="/courses" className="flex items-center gap-1 text-sm font-medium text-ink/80 transition hover:text-brand">
            Browse Courses <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </Link>
          <Link href="/become-instructor" className="text-sm font-medium text-ink/80 transition hover:text-brand">
            Teach
          </Link>
          <Link href="/blog" className="text-sm font-medium text-ink/80 transition hover:text-brand">
            Blog
          </Link>
          <Link href="/page/about" className="text-sm font-medium text-ink/80 transition hover:text-brand">
            About
          </Link>
          <Link href="/contact" className="text-sm font-medium text-ink/80 transition hover:text-brand">
            Contact
          </Link>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mx-auto hidden max-w-md flex-1 md:block">
          <label className="relative flex items-center">
            <Search className="absolute left-4 h-4 w-4 text-muted" />
            <input
              type="search"
              placeholder="Search for courses, skills, or instructors..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-transparent bg-surface py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:border-brand focus:bg-card focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </label>
        </form>

        {/* Actions */}
        <div className="ml-auto hidden items-center gap-1 md:flex">
          <Link href="/cart" aria-label="Cart" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 transition hover:bg-surface hover:text-brand">
            <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          <Link href={user ? dashHref : '/login'} aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-full text-ink/70 transition hover:bg-surface hover:text-brand">
            <Bell className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          {user ? (
            <>
              <Link href={dashHref} className="ml-1 rounded-full px-4 py-2.5 text-sm font-semibold text-ink transition hover:text-brand">
                Dashboard
              </Link>
              <button onClick={logout} className="btn-primary px-5 py-2.5 text-sm">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="ml-1 rounded-full px-4 py-2.5 text-sm font-semibold text-ink transition hover:text-brand">
                Log in
              </Link>
              <Link href="/register" className="btn-primary px-5 py-2.5 text-sm">
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="ml-auto rounded-lg p-2 text-muted hover:bg-surface hover:text-ink md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-card px-4 pb-5 pt-4 md:hidden">
          <form onSubmit={handleSearch} className="mb-4">
            <label className="relative flex items-center">
              <Search className="absolute left-4 h-4 w-4 text-muted" />
              <input
                type="search"
                placeholder="Search for courses, skills, or instructors..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-full bg-surface py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>
          </form>
          <div className="flex flex-col gap-1">
            <Link href="/courses" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>Browse Courses</Link>
            <Link href="/become-instructor" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>Teach</Link>
            <Link href="/blog" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>Blog</Link>
            <Link href="/page/about" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>About</Link>
            <Link href="/contact" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>Contact</Link>
            <Link href="/cart" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpen(false)}>Cart</Link>
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              {user ? (
                <>
                  <Link href={dashHref} className="btn-ghost justify-center text-sm" onClick={() => setOpen(false)}>Dashboard</Link>
                  <button className="btn-primary text-sm" onClick={logout}>Sign out</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost justify-center text-sm" onClick={() => setOpen(false)}>Log in</Link>
                  <Link href="/register" className="btn-primary text-sm" onClick={() => setOpen(false)}>Sign up</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
