'use client';

import {
  Award, BadgePercent, Briefcase, Building2, CreditCard, FileText, FolderOpen, LayoutDashboard, Mail,
  Palette, Phone, ShieldCheck, Target, Users, Wallet, TrendingUp, BookText, FileSearch, Cog,
} from 'lucide-react';
import { useAuth, useBranding } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';

/**
 * Platform-owner shell — same left navbar design as every other dashboard.
 * Every super-admin-only ability is surfaced here, grouped so nothing lives
 * hidden inside the tenant-admin console. The settings pages themselves sit
 * under /dashboard/admin/settings/* (shared route namespace), but they are
 * super-admin-gated and only ever linked from this sidebar.
 */
export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const branding = useBranding();

  return (
    <DirectoryShell
      eyebrow="Global Admin"
      tenantName={branding?.name}
      sections={[
        {
          heading: 'Console',
          links: [
            { href: '/dashboard/superadmin', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/dashboard/superadmin/tenants', label: 'Sub-accounts', icon: Building2 },
            { href: '/dashboard/superadmin/plans', label: 'Plans', icon: CreditCard },
            { href: '/dashboard/superadmin/admins', label: 'Platform staff', icon: Users },
            { href: '/dashboard/superadmin/resellers', label: 'Resellers', icon: Briefcase },
            { href: '/dashboard/superadmin/leads', label: 'Leads', icon: Target },
            { href: '/dashboard/superadmin/users', label: 'All users', icon: ShieldCheck },
            { href: '/dashboard/superadmin/revenue', label: 'Revenue', icon: TrendingUp },
          ],
        },
        {
          heading: 'Platform settings',
          links: [
            { href: '/dashboard/superadmin/coupons', label: 'Coupons & Offers', icon: BadgePercent },
            { href: '/dashboard/admin/settings/payment', label: 'Payment gateways', icon: Wallet },
            { href: '/dashboard/superadmin/white-label', label: 'White label', icon: Palette },
            { href: '/dashboard/admin/settings/mail', label: 'Mail', icon: Mail },
            { href: '/dashboard/admin/settings/files', label: 'Files', icon: FolderOpen },
            { href: '/dashboard/admin/settings/pages', label: 'Static pages', icon: FileText },
            { href: '/dashboard/admin/settings/certificate', label: 'Certificate', icon: Award },
            { href: '/dashboard/admin/settings/contact', label: 'Contact info', icon: Phone },
            { href: '/dashboard/superadmin/logs', label: 'Activity logs', icon: FileSearch },
            { href: '/dashboard/superadmin/permissions', label: 'Permissions', icon: Cog },
            { href: '/dashboard/superadmin/settings', label: 'Settings', icon: BookText },
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
