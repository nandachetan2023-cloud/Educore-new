import { Space_Grotesk, Plus_Jakarta_Sans } from 'next/font/google';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-admin-display' });
const body = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-admin-body' });

// Scoped to /dashboard/admin only — the public marketing site keeps its own
// Poppins (--font-sans) from the root layout; this console gets its own
// display/body pairing without touching the global font.
export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable}`}>{children}</div>;
}
