'use client';

import { Building2, CreditCard, LayoutDashboard, Palette, Users, Wallet } from 'lucide-react';
import { useAuth, useBranding } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';

/** Platform-owner shell — same left navbar design as every other dashboard. */
export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const branding = useBranding();

  return (
    <DirectoryShell
      eyebrow="Global Admin"
      tenantName={branding?.name}
      sections={[
        {
          heading: 'Platform',
          links: [
            { href: '/dashboard/superadmin', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/dashboard/superadmin/tenants', label: 'Sub-accounts', icon: Building2 },
            { href: '/dashboard/superadmin/plans', label: 'Plans', icon: CreditCard },
            { href: '/dashboard/admin/settings/payment', label: 'Payments', icon: Wallet },
            { href: '/dashboard/admin/white-label', label: 'Branding', icon: Palette },
            { href: '/dashboard/admin/admins', label: 'Platform staff', icon: Users },
          ],
        },
      ]}
      userName={user?.name ?? branding?.name ?? 'Admin'}
      userCaption="Super admin"
      userImage={user?.image}
      onLogout={logout}
    >
      {children}
    </DirectoryShell>
  );
}
