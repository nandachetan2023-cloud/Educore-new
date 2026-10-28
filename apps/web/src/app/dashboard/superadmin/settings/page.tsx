'use client';
import { useAuth } from '@/lib/providers';
import { useRouter } from 'next/navigation';
import { SuperAdminShell } from '@/components/superadmin-shell';
export default function Page() {
  const { user, loading } = useAuth();
  const r = useRouter();
  if (loading) return <div className="py-20 text-center text-muted">Loading...</div>;
  if (!user || user.principal !== 'admin' || user.adminRole !== 'super_admin') {
    r.push('/login?next=/dashboard/superadmin/settings');
    return null;
  }
  return (
    <SuperAdminShell>
      <div className="container-page">
        <h1 className="text-3xl font-extrabold">Platform Settings</h1>
        <p className="text-muted">Global settings, environment, and platform-level configuration.</p>
      </div>
    </SuperAdminShell>
  );
}
