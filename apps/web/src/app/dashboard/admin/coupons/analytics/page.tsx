'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgePercent, LayoutDashboard, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';
import { CouponAnalyticsView } from '@/components/coupon-analytics-view';

export default function CouponAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin' || user.adminRole === 'super_admin') {
      router.push(user && user.adminRole === 'super_admin' ? '/dashboard/superadmin/coupons/analytics' : '/login?next=/dashboard/admin/coupons/analytics');
    }
  }, [user, authLoading, router]);

  return (
    <DirectoryShell
      eyebrow="Admin Console"
      sections={[
        {
          heading: 'Sales',
          links: [
            { href: '/dashboard/admin/coupons/analytics', label: 'Coupon analytics', icon: TrendingUp },
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
          <Link href="/dashboard/admin/coupons" className="text-sm text-muted hover:text-brand">← Coupons</Link>
          <div className="mt-2">
            <CouponAnalyticsView />
          </div>
        </div>
      </div>
    </DirectoryShell>
  );
}
