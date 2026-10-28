'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import { SuperAdminShell } from '@/components/superadmin-shell';

export default function SuperAdminUsersPage() {
  const { user, loading } = useAuth();
  const r = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user || user.principal !== 'admin' || user.adminRole !== 'super_admin') {
      r.push('/login?next=/dashboard/superadmin/users');
      return;
    }
    api<any[]>('/admin/users').then((d) => setUsers(d || [])).catch(() => setUsers([]));
  }, [user, loading, r]);

  const filtered = users.filter((u) =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <SuperAdminShell>
      <div className="container-page py-8">
        <h1 className="text-3xl font-extrabold">All Users</h1>
        <p className="text-muted">Platform-wide students, instructors, and admins.</p>

        <div className="mt-6 rounded-2xl border border-line bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-6 py-4">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, role..."
              className="bg-transparent text-sm outline-none placeholder:text-muted w-full"
            />
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-surface text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Tenant</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((u: any) => (
                <tr key={`${u.id}-${u.role}`} className="hover:bg-surface">
                  <td className="px-6 py-3 font-medium">{u.name}</td>
                  <td className="px-6 py-3 text-muted">{u.email}</td>
                  <td className="px-6 py-3 capitalize">{u.role}</td>
                  <td className="px-6 py-3 text-muted">{u.tenant?.name || '-'}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${u.approveStatus === 'approved' ? 'bg-green-500/10 text-green-700' : 'bg-amber-500/10 text-amber-600'}`}>
                      {u.approveStatus || 'pending'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminShell>
  );
}
