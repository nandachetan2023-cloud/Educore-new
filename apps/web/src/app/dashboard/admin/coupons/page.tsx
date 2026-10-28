'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgePercent, LayoutDashboard } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';
import { StatTile } from '@/components/stat-tile';
import type { Coupon, CouponSummary, Paginated } from '@/lib/types';
import { discountLabel } from '@/lib/types';

interface CourseMap { id: number; title: string }

/**
 * READ-ONLY view for the tenant Admin (spec §6 "My Coupons"): shows the
 * coupon codes the Super Admin granted to THIS workspace. Only the Super
 * Admin can create/grant/disable coupons — admins view here, their users
 * redeem automatically at checkout on this workspace.
 */
export default function MyCouponsPage() {
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [summary, setSummary] = useState<CouponSummary | null>(null);
  const [courses, setCourses] = useState<CourseMap[]>([]);
  const [loading, setLoading] = useState(true);

  const currency = branding?.currency ?? 'USD';
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin' || user.adminRole === 'super_admin') {
      router.push(user && user.adminRole === 'super_admin' ? '/dashboard/superadmin/coupons' : '/login?next=/dashboard/admin/coupons');
      return;
    }
    Promise.all([
      api<Coupon[]>('/admin/coupons').then(setCoupons).catch(() => setCoupons([])),
      api<CouponSummary>('/admin/coupons/summary').then(setSummary).catch(() => setSummary(null)),
      api<Paginated<{ id: number; title: string }>>('/courses?perPage=100', { auth: false })
        .then((r) => setCourses((r.data ?? []).map((c) => ({ id: c.id, title: c.title }))))
        .catch(() => setCourses([])),
    ]).finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const titleOf = (id: number) => courses.find((c) => c.id === id)?.title ?? `Course #${id}`;

  return (
    <DirectoryShell
      eyebrow="Admin Console"
      sections={[
        {
          heading: 'Sales',
          links: [
            { href: '/dashboard/admin/coupons', label: 'My Coupons', icon: BadgePercent },
            { href: '/dashboard/admin', label: 'Back to Console', icon: LayoutDashboard, match: '' },
          ],
        },
      ]}
      userName={user?.name ?? 'Admin'}
      userCaption="Tenant admin"
      userImage={user?.image}
      onLogout={() => { if (confirm('Sign out?')) router.push('/login'); }}
    >
      <div style={{ fontFamily: 'var(--font-admin-body)' }}>
        <div className="mx-auto max-w-[1220px]">
          <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
          <header className="mb-6 mt-2">
            <p className="mb-1 text-[12.5px] font-semibold text-brand">SALES PROMOTIONS</p>
            <h1 className="text-[27px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-admin-display)' }}>My Coupons</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Coupon codes granted to this workspace by the Super Admin. Your customers can apply these at checkout
              on your store — no action needed from you. Codes granted to other workspaces are never visible here
              and cannot be used on your store.
            </p>
          </header>

          {loading ? (
            <div className="card p-12 text-center text-[#93897B]">Loading…</div>
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Coupons granted" value={coupons?.length ?? 0} hint="By the Super Admin" />
                <StatTile label="Active now" value={coupons?.filter((c) => c.status).length ?? 0} hint="Redeemable at checkout" />
                <StatTile label="Redemptions" value={summary?.redemptions ?? 0} hint="Completed orders" />
                <StatTile
                  label="Revenue given back"
                  value={fmt(summary?.revenueSaved ?? 0)}
                  hint={`Avg ${fmt(summary?.averageSaving ?? 0)} per order`}
                />
              </section>

              <section className="mt-6 overflow-hidden rounded-2xl border border-[#EAE6DB] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#F0EDE4] text-[11px] uppercase tracking-wider text-[#837F73]">
                    <tr>
                      <th className="px-5 py-3">Code</th>
                      <th className="px-5 py-3">Discount</th>
                      <th className="px-5 py-3">Applies to</th>
                      <th className="px-5 py-3">Window</th>
                      <th className="px-5 py-3">Used</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F3EC]">
                    {(coupons ?? []).map((c) => (
                      <tr key={c.id}>
                        <td className="px-5 py-4">
                          <span className="font-mono text-[13px] font-bold text-[#16161A]">{c.code}</span>
                          {c.description && <p className="mt-0.5 max-w-[220px] text-xs text-[#93897B]">{c.description}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-brand">{discountLabel(c.type, c.value)}</span>
                          {c.maxDiscount != null && <p className="text-xs text-muted">max {fmt(c.maxDiscount)}</p>}
                        </td>
                        <td className="px-5 py-4 text-muted">
                          {c.target === 'all' && 'Every course'}
                          {c.target === 'courses' && (c.courseIds?.length ? `${c.courseIds.length} course(s): ${c.courseIds.map(titleOf).slice(0, 2).join(', ')}${c.courseIds.length > 2 ? '…' : ''}` : 'Selected courses')}
                          {c.target === 'categories' && `${c.categoryIds?.length ?? 0} categor(ies)`}
                        </td>
                        <td className="px-5 py-4 text-xs text-muted">
                          {c.startsAt ? new Date(c.startsAt).toLocaleDateString() : 'Anytime'}
                          {' → '}
                          {c.endsAt ? new Date(c.endsAt).toLocaleDateString() : 'No end'}
                        </td>
                        <td className="px-5 py-4 font-semibold">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                        <td className="px-5 py-4">
                          <span className={`badge ${c.status ? 'bg-green-500/15 text-green-600' : 'bg-line text-muted'}`}>
                            {c.status ? 'Active' : 'Paused'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {coupons?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-[#93897B]">
                          No coupons granted to your workspace yet — the Super Admin creates and grants them.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </div>
      </div>
    </DirectoryShell>
  );
}
