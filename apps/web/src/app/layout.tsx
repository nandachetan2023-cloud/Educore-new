import './globals.css';
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { Providers } from '@/lib/providers';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import type { Branding } from '@/lib/types';

const DEV_TENANT_COOKIE = 'educore.devTenant';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const DEFAULT_BRANDING: Branding = {
  name: 'EduCore',
  logo: '/brand/logo.svg',
  favicon: '/brand/favicon.ico',
  primaryColor: '#4f46e5',
  secondaryColor: '#0ea5e9',
  currency: 'USD',
  commissionRate: 20,
};

/**
 * Resolves branding for whichever tenant this request's host belongs to —
 * folded into the fetch URL itself (not just a header) because Next's fetch
 * Data Cache keys on the URL, not headers. A plain `${base}/branding` here
 * would let one tenant's cached response leak to another tenant's visitors
 * for the 60s revalidate window. This intentionally makes the root layout
 * dynamic (per-request), which is required for real per-host branding
 * rather than a build-time-static default.
 */
async function getBranding(): Promise<Branding> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
    const devTenant = cookies().get(DEV_TENANT_COOKIE)?.value;
    const host = headers().get('host')?.split(':')[0];
    const params = new URLSearchParams();
    if (devTenant) params.set('devTenant', devTenant);
    else if (host) params.set('host', host);
    const qs = params.toString();
    const res = await fetch(`${base}/branding${qs ? `?${qs}` : ''}`, { next: { revalidate: 60 } });
    if (!res.ok) return DEFAULT_BRANDING;
    const data = await res.json();
    return {
      name: data.name || DEFAULT_BRANDING.name,
      logo: data.logo || DEFAULT_BRANDING.logo,
      favicon: data.favicon || DEFAULT_BRANDING.favicon,
      primaryColor: data.primaryColor || DEFAULT_BRANDING.primaryColor,
      secondaryColor: data.secondaryColor || DEFAULT_BRANDING.secondaryColor,
      currency: data.currency || DEFAULT_BRANDING.currency,
      commissionRate: data.commissionRate ?? DEFAULT_BRANDING.commissionRate,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: { default: `${branding.name} — Learn without limits`, template: `%s · ${branding.name}` },
    description: `${branding.name} is an online learning marketplace. Explore courses taught by expert instructors.`,
    // Favicon is white-label too — pulled from the admin-set branding.
    icons: branding.favicon ? { icon: branding.favicon } : undefined,
  };
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  const primaryRgb = hexToRgb(branding.primaryColor);
  const secondaryRgb = hexToRgb(branding.secondaryColor);
  return (
    <html
      lang="en"
      className={poppins.variable}
      style={{ '--brand-primary': primaryRgb, '--brand-secondary': secondaryRgb } as React.CSSProperties}
    >
      <body>
        <Providers branding={branding}>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
