'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  Download,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Palette,
  Search,
  BadgePercent,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';

interface InstructorRow {
  id: number;
  name: string;
  email: string;
  headline?: string | null;
  image?: string | null;
  bio?: string | null;
  approveStatus: 'pending' | 'approved' | 'rejected';
  wallet: number;
  createdAt: string;
  _count: { courses: number };
}

interface StudentRow {
  id: number;
  name: string;
  email: string;
  image?: string | null;
  headline?: string | null;
  bio?: string | null;
  approveStatus?: 'pending' | 'approved' | 'rejected';
  wallet?: number;
  createdAt: string;
  _count: { enrollments: number };
}

interface DirectoryUser {
  id: number;
  kind: 'instructor' | 'student';
  name: string;
  email: string;
  image?: string | null;
  headline?: string | null;
  bio?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  wallet: number;
  activity: number;
  activityLabel: string;
  createdAt: string;
}

const PAGE_SIZE = 8;

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
}

function Avatar({ name, image, size = 'h-9 w-9' }: { name: string; image?: string | null; size?: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={`${size} rounded-full object-cover shadow-sm`} />;
  }
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand`}>
      {initials(name)}
    </span>
  );
}

function StatusBadge({ status }: { status: DirectoryUser['status'] }) {
  if (status === 'approved')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> Active
      </span>
    );
  if (status === 'rejected')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> Pending
    </span>
  );
}

function RoleBadge({ kind }: { kind: DirectoryUser['kind'] }) {
  return kind === 'instructor' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">
      <GraduationCap className="h-3 w-3" /> Instructor
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
      <Users className="h-3 w-3" /> Student
    </span>
  );
}

export default function UserDirectoryPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const branding = useBranding();
  const router = useRouter();

  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'instructor' | 'student'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DirectoryUser['status']>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspector, setInspector] = useState<DirectoryUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'student' as 'student' | 'instructor' });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const currency = branding?.currency ?? 'USD';
  const money = (n: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3400);
  };

  const load = () => {
    Promise.all([
      api<InstructorRow[]>('/admin/instructors').catch(() => []),
      api<StudentRow[]>('/admin/students').catch(() => []),
    ]).then(([i, s]) => {
      setInstructors(i);
      setStudents(s);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?next=/dashboard/admin/users');
      return;
    }
    if (user.principal !== 'admin') {
      router.push('/dashboard');
      return;
    }
    if (user.adminRole === 'super_admin') {
      router.push('/dashboard/superadmin');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const all: DirectoryUser[] = useMemo(
    () => [
      ...instructors.map((i) => ({
        id: i.id,
        kind: 'instructor' as const,
        name: i.name,
        email: i.email,
        image: i.image,
        headline: i.headline,
        bio: i.bio,
        status: i.approveStatus,
        wallet: i.wallet ?? 0,
        activity: i._count.courses,
        activityLabel: 'courses',
        createdAt: i.createdAt,
      })),
      ...students.map((s) => ({
        id: s.id,
        kind: 'student' as const,
        name: s.name,
        email: s.email,
        image: s.image,
        headline: s.headline,
        bio: s.bio,
        status: (s.approveStatus ?? 'approved') as DirectoryUser['status'],
        wallet: s.wallet ?? 0,
        activity: s._count.enrollments,
        activityLabel: 'enrollments',
        createdAt: s.createdAt,
      })),
    ],
    [instructors, students],
  );

  const pendingCount = all.filter((u) => u.status === 'pending').length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((u) => (roleFilter === 'all' ? true : u.kind === roleFilter))
      .filter((u) => (statusFilter === 'all' ? true : u.status === statusFilter))
      .filter((u) => (!q ? true : u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [all, query, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [query, roleFilter, statusFilter]);

  const key = (u: DirectoryUser) => `${u.kind}:${u.id}`;

  const toggleSelect = (u: DirectoryUser) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(u);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === pageRows.length && pageRows.length > 0
        ? new Set()
        : new Set(pageRows.map(key)),
    );
  };

  const setStatus = async (u: DirectoryUser, status: 'approved' | 'rejected') => {
    if (u.kind !== 'instructor') return;
    setErr(null);
    setBusyId(u.id);
    try {
      await api(`/admin/instructors/${u.id}/${status}`, { method: 'POST' });
      setInstructors((prev) => prev.map((i) => (i.id === u.id ? { ...i, approveStatus: status } : i)));
      setInspector((prev) => (prev && prev.kind === 'instructor' && prev.id === u.id ? { ...prev, status } : prev));
      showToast(`${u.name} ${status === 'approved' ? 'approved' : 'rejected'}.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update instructor');
    } finally {
      setBusyId(null);
    }
  };

  const approveSelected = async () => {
    const targets = filtered.filter(
      (u) => selected.has(key(u)) && u.kind === 'instructor' && u.status !== 'approved',
    );
    if (targets.length === 0) {
      showToast('Nothing to approve in this selection.');
      return;
    }
    let done = 0;
    for (const t of targets) {
      try {
        await api(`/admin/instructors/${t.id}/approved`, { method: 'POST' });
        done += 1;
      } catch {
        /* keep going */
      }
    }
    setInstructors((prev) =>
      prev.map((i) => (targets.some((t) => t.id === i.id) ? { ...i, approveStatus: 'approved' as const } : i)),
    );
    setSelected(new Set());
    showToast(`Approved ${done} instructor${done === 1 ? '' : 's'}.`);
    if (done < targets.length) setErr('Some approvals failed — please retry.');
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteBusy(true);
    setErr(null);
    try {
      const res = await api<{ id: number; tempPassword?: string }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      });
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'student' });
      load();
      showToast(
        res.tempPassword
          ? `Account created. One-time password: ${res.tempPassword}`
          : 'Account created.',
      );
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to create account');
    } finally {
      setInviteBusy(false);
    }
  };

  const copyEmail = (email: string) => {
    navigator.clipboard?.writeText(email).then(
      () => showToast(`Copied ${email}`),
      () => showToast('Copy failed'),
    );
  };

  const resetFilters = () => {
    setQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  const kpis = [
    { label: 'Total Users', value: all.length, sub: `${students.length} students · ${instructors.length} instructors`, pct: 100, tone: 'bg-brand' },
    { label: 'Active Accounts', value: all.filter((u) => u.status === 'approved').length, sub: 'Approved and learning', pct: all.length ? (all.filter((u) => u.status === 'approved').length / all.length) * 100 : 0, tone: 'bg-green-600' },
    { label: 'Instructors', value: instructors.length, sub: `${instructors.reduce((n, i) => n + i._count.courses, 0)} courses published`, pct: all.length ? (instructors.length / all.length) * 100 : 0, tone: 'bg-brand' },
    { label: 'Pending Approvals', value: pendingCount, sub: pendingCount ? 'Action needed' : 'All clear', pct: all.length ? (pendingCount / all.length) * 100 : 0, tone: pendingCount ? 'bg-amber-500' : 'bg-green-600' },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-[1400px] px-6 py-10">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-line/50" />
            ))}
          </div>
          <div className="mt-6 h-96 animate-pulse rounded-2xl bg-line/50" />
        </div>
      </div>
    );
  }

  return (
    <DirectoryShell
      eyebrow="Admin Console"
      sections={[
        {
          heading: 'Directory & Access',
          links: [
            { href: '/dashboard/admin/users', label: 'Users & Directory', icon: Users, badge: pendingCount },
            { href: '/dashboard/admin', label: 'Back to Console', icon: LayoutDashboard, match: '' },
          ],
        },
        {
          heading: 'Branding & Domains',
          links: [
            { href: '/dashboard/admin/white-label', label: 'White-Label & Themes', icon: Palette },
            { href: '/dashboard/admin/domain', label: 'Custom Domains & DNS', icon: Globe },
          ],
        },
        {
          heading: 'Sales',
          links: [{ href: '/dashboard/admin/coupons', label: 'Coupons & Offers', icon: BadgePercent }],
        },
      ]}
      userName={user?.name ?? 'Admin'}
      userCaption="Tenant admin"
      userImage={user?.image}
      onLogout={logout}
      searchPlaceholder="Search users, emails, or roles…"
      searchValue={query}
      onSearch={setQuery}
      notifCount={pendingCount}
    >
      {/* Title row */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">Directory</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Users &amp; Directory</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Manage {all.length} user identities — approve instructors, track enrollments, and invite new members.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => showToast('Export is not available yet.')}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface"
          >
            <Download className="h-4 w-4 text-muted" /> Export
          </button>
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95"
          >
            <UserPlus className="h-4 w-4" /> Invite User
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:shadow-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{k.label}</p>
            <p className="mt-2 text-[32px] font-bold leading-none tracking-tight text-ink">{k.value}</p>
            <p className="mt-1.5 text-xs text-muted">{k.sub}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
              <div className={`h-full rounded-full ${k.tone}`} style={{ width: `${Math.min(100, k.pct)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {err && (
        <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-600">{err}</p>
      )}

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand px-5 py-3 text-white shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" /> {selected.size} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={approveSelected}
              className="rounded-xl bg-white/15 px-4 py-1.5 text-[13px] font-semibold transition hover:bg-white/25"
            >
              Approve instructors
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-xl bg-white/15 px-4 py-1.5 text-[13px] font-semibold transition hover:bg-white/25"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Filter deck */}
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm xl:flex-row xl:items-center">
        <label className="relative flex flex-1 items-center">
          <Search className="absolute left-4 h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-10 w-full rounded-xl bg-surface pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            className="h-10 rounded-xl bg-surface px-4 text-sm font-medium text-ink focus:outline-none"
          >
            <option value="all">Role: All</option>
            <option value="instructor">Role: Instructors</option>
            <option value="student">Role: Students</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-10 rounded-xl bg-surface px-4 text-sm font-medium text-ink focus:outline-none"
          >
            <option value="all">Status: All</option>
            <option value="approved">Status: Active</option>
            <option value="pending">Status: Pending</option>
            <option value="rejected">Status: Rejected</option>
          </select>
          <button
            onClick={resetFilters}
            className="h-10 rounded-xl bg-surface px-4 text-sm font-semibold text-muted transition hover:text-ink"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="h-11 bg-surface text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                <th className="w-12 px-5 text-center">
                  <input
                    type="checkbox"
                    checked={pageRows.length > 0 && selected.size === pageRows.length && pageRows.every((r) => selected.has(key(r)))}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer rounded accent-brand"
                  />
                </th>
                <th className="px-4 font-semibold">User Identity</th>
                <th className="px-4 font-semibold">Role</th>
                <th className="px-4 font-semibold">Activity</th>
                <th className="px-4 font-semibold">Joined</th>
                <th className="px-4 font-semibold">Status</th>
                <th className="px-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm text-ink">
              {pageRows.map((u) => (
                <tr key={key(u)} className="h-16 transition-colors hover:bg-surface">
                  <td className="px-5 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(key(u))}
                      onChange={() => toggleSelect(u)}
                      className="h-4 w-4 cursor-pointer rounded accent-brand"
                    />
                  </td>
                  <td className="px-4">
                    <button onClick={() => setInspector(u)} className="flex min-w-[220px] items-center gap-3 text-left">
                      <Avatar name={u.name} image={u.image} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold hover:text-brand">{u.name}</span>
                        <span className="block truncate text-xs text-muted">{u.email}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4">
                    <RoleBadge kind={u.kind} />
                  </td>
                  <td className="px-4 text-muted">
                    <span className="font-semibold text-ink">{u.activity}</span> {u.activityLabel}
                  </td>
                  <td className="px-4 text-[13px] text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-5 text-right">
                    <div className="flex justify-end gap-2">
                      {u.kind === 'instructor' && u.status !== 'approved' && (
                        <button
                          onClick={() => setStatus(u, 'approved')}
                          disabled={busyId === u.id}
                          className="rounded-lg bg-green-600 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                        >
                          Approve
                        </button>
                      )}
                      {u.kind === 'instructor' && u.status !== 'rejected' && (
                        <button
                          onClick={() => setStatus(u, 'rejected')}
                          disabled={busyId === u.id}
                          className="rounded-lg border border-line px-3.5 py-1.5 text-[13px] font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      )}
                      {(u.kind !== 'instructor' || u.status === 'approved') && (
                        <button
                          onClick={() => setInspector(u)}
                          className="rounded-lg bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink transition hover:bg-brand-soft hover:text-brand"
                        >
                          Inspect
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-muted">
              <Search className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-bold text-ink">No matching users</h3>
            <p className="mt-1 max-w-sm text-sm text-muted">Try adjusting your search or filters — or invite someone new.</p>
            <button onClick={resetFilters} className="mt-4 text-sm font-semibold text-brand hover:underline">
              Clear all filters
            </button>
          </div>
        )}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-line bg-card px-5 py-3.5 text-[13px] text-muted sm:flex-row">
          <span>
            Showing <strong className="text-ink">{filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</strong> of{' '}
            <strong className="text-ink">{filtered.length}</strong> users
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg bg-surface px-3.5 py-1.5 font-semibold transition hover:bg-brand-soft hover:text-brand disabled:opacity-40"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`h-8 w-8 rounded-lg text-[13px] font-semibold transition ${
                  safePage === i + 1 ? 'bg-brand text-white' : 'text-muted hover:bg-surface hover:text-ink'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg bg-surface px-3.5 py-1.5 font-semibold transition hover:bg-brand-soft hover:text-brand disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Inspector drawer */}
      {inspector && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setInspector(null)} />
          <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-line p-6">
              <div className="flex items-center gap-3.5">
                <Avatar name={inspector.name} image={inspector.image} size="h-14 w-14" />
                <div>
                  <h2 className="text-lg font-bold text-ink">{inspector.name}</h2>
                  <p className="text-[13px] text-muted">{inspector.email}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <RoleBadge kind={inspector.kind} />
                    <StatusBadge status={inspector.status} />
                  </div>
                </div>
              </div>
              <button onClick={() => setInspector(null)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 p-6">
              {(inspector.headline || inspector.bio) && (
                <section className="rounded-2xl bg-surface p-4">
                  {inspector.headline && <p className="text-sm font-semibold text-ink">{inspector.headline}</p>}
                  {inspector.bio && <p className="mt-1 text-[13px] leading-relaxed text-muted">{inspector.bio}</p>}
                </section>
              )}
              <section className="grid grid-cols-3 gap-2.5">
                <div className="rounded-2xl bg-surface p-3.5 text-center">
                  <p className="text-xl font-bold text-ink">{inspector.activity}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{inspector.activityLabel}</p>
                </div>
                <div className="rounded-2xl bg-surface p-3.5 text-center">
                  <p className="text-xl font-bold text-ink">{money(inspector.wallet).replace(/\.00$/, '')}</p>
                  <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted">
                    <Wallet className="h-3 w-3" /> wallet
                  </p>
                </div>
                <div className="rounded-2xl bg-surface p-3.5 text-center">
                  <p className="text-xl font-bold text-ink">{new Date(inspector.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>
                  <p className="mt-0.5 text-[11px] text-muted">joined</p>
                </div>
              </section>
              <section className="rounded-2xl bg-surface p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Account</p>
                <div className="mt-2 space-y-2 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Email</span>
                    <button onClick={() => copyEmail(inspector.email)} className="flex items-center gap-1 font-semibold text-ink hover:text-brand">
                      <span className="max-w-[180px] truncate">{inspector.email}</span>
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Joined</span>
                    <span className="font-medium text-ink">{new Date(inspector.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </section>
              {inspector.kind === 'instructor' && (
                <section className="flex gap-2.5">
                  {inspector.status !== 'approved' && (
                    <button
                      onClick={() => setStatus(inspector, 'approved')}
                      disabled={busyId === inspector.id}
                      className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                    >
                      Approve instructor
                    </button>
                  )}
                  {inspector.status !== 'rejected' && (
                    <button
                      onClick={() => setStatus(inspector, 'rejected')}
                      disabled={busyId === inspector.id}
                      className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setInviteOpen(false)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand">
                  <UserPlus className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-bold text-ink">Invite Team Member</h2>
              </div>
              <button onClick={() => setInviteOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={invite} className="space-y-4 p-5">
              <div>
                <label className="label">Full name</label>
                <input
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email address</label>
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Role</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['student', 'instructor'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteForm((f) => ({ ...f, role: r }))}
                      className={`rounded-xl py-2.5 text-sm font-semibold capitalize transition ${
                        inviteForm.role === r ? 'bg-brand text-white shadow-sm' : 'bg-surface text-muted hover:text-ink'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface p-3.5 text-[13px] text-muted">
                <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" />
                Invited accounts are approved immediately — a one-time password is shown after creation.
              </div>
              <div className="flex justify-end gap-2.5 border-t border-line pt-4">
                <button type="button" onClick={() => setInviteOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-muted hover:text-ink">
                  Cancel
                </button>
                <button disabled={inviteBusy} className="btn-primary rounded-xl px-6 py-2.5 text-sm disabled:opacity-60">
                  {inviteBusy ? 'Sending…' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex max-w-sm items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-2xl">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
          <span className="break-words">{toast}</span>
        </div>
      )}
    </DirectoryShell>
  );
}
