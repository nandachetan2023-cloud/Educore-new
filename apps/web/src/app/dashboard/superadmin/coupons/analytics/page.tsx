'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgePercent, LayoutDashboard, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';
import { CouponAnalyticsView } from '@/components/coupon-analytics-view';

export default function SuperadminCouponAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.adminRole !== 'super_admin') {
      router.push('/login?next=/dashboard/superadmin/coupons/analytics');
    }
  }, [user, authLoading, router]);

  return (
    <DirectoryShell
      eyebrow="Global Admin"
      sections={[
        {
          heading: 'Sales',
          links: [
            { href: '/dashboard/superadmin/coupons/analytics', label: 'Coupon analytics', icon: TrendingUp },
            { href: '/dashboard/superadmin/coupons', label: 'Coupons & Offers', icon: BadgePercent },
            { href: '/dashboard/superadmin', label: 'Back to Console', icon: LayoutDashboard, match: '' },
          ],
        },
      ]}
      userName={user?.name ?? 'Super Admin'}
      userCaption="Platform super admin"
      userImage={user?.image}
      onLogout={() => { if (confirm('Sign out?')) router.push('/login'); }}
    >
      <div style={{ fontFamily: 'var(--font-admin-body)' }}>
        <div className="mx-auto max-w-[1220px]">
          <Link href="/dashboard/superadmin/coupons" className="text-sm text-muted hover:text-brand">← Coupons &amp; Offers</Link>
          <div className="mt-2">
            <CouponAnalyticsView showTenant />
          </div>
        </div>
      </div>
    </DirectoryShell>
  );
}
