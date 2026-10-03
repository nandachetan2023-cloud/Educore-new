'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

/**
 * Site chrome wrapper. Dashboard routes render inside their own
 * DirectoryShell (fixed sidebar + header), so the marketing Navbar and
 * Footer are hidden there — otherwise the footer slides underneath the
 * fixed sidebar and the page gets two navbars.
 */
export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === '/dashboard' || pathname?.startsWith('/dashboard/');
  return (
    <div className="flex min-h-screen flex-col">
      {!bare && <Navbar />}
      <main className="flex-1">{children}</main>
      {!bare && <Footer />}
    </div>
  );
}
