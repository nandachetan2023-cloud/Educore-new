'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, GraduationCap, LayoutDashboard, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/dashboard/profile');
  }, [loading, user, router]);

  if (loading || !user) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  const roleLabel =
    user.principal === 'admin'
      ? user.adminRole === 'super_admin' ? 'Platform Super Admin' : 'Workspace Admin'
      : user.principal === 'instructor' ? 'Instructor' : 'Student';

  return (
    <DirectoryShell
      eyebrow="Account"
      sections={[
        {
          heading: 'Account',
          links: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/dashboard/profile', label: 'Profile', icon: User },
            { href: '/dashboard/security', label: 'Security', icon: ShieldCheck },
          ],
        },
        {
          heading: 'Learn',
          links: [
            { href: '/courses', label: 'Browse Courses', icon: BookOpen },
            { href: '/become-instructor', label: 'Become an Instructor', icon: GraduationCap },
          ],
        },
      ]}
      userName={user.name ?? 'Account'}
      userCaption={roleLabel}
      userImage={user.image}
      onLogout={logout}
    >
      <div className="mx-auto max-w-[800px] space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Profile</h1>
          <p className="mt-2 text-[15px] text-muted">Your account details.</p>
        </div>

        <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-line bg-brand text-xl font-extrabold text-white">
              {user.image ? <img src={user.image} alt="" className="h-full w-full object-cover" /> : (user.name?.[0] ?? 'U').toUpperCase()}
            </span>
            <div>
              <div className="text-lg font-bold text-ink">{user.name}</div>
              <div className="text-sm text-muted">{user.email}</div>
              <div className="mt-1 text-xs font-semibold text-brand">{roleLabel}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted">Role</div>
              <div className="mt-1 text-sm text-ink">{user.principal}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted">Two-factor auth</div>
              <div className="mt-1 text-sm text-ink">{user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</div>
            </div>
          </div>

          <div className="mt-6">
            <Link href="/dashboard/security" className="btn-primary inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Manage security
            </Link>
          </div>
        </section>
      </div>
    </DirectoryShell>
  );
}
