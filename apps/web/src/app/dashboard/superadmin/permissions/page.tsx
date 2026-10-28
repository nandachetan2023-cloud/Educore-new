'use client';
import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/providers';
import { useRouter } from 'next/navigation';
import { Check, Minus, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { SuperAdminShell } from '@/components/superadmin-shell';

type Cell = 'yes' | 'no' | 'partial';
type RoleKey = 'superadmin' | 'admin' | 'instructor' | 'student';

interface PermissionRow {
  area: string;
  permission: string;
  superadmin: Cell;
  admin: Cell;
  instructor: Cell;
  student: Cell;
}

const MATRIX: PermissionRow[] = [
  { area: 'Platform', permission: 'Create / delete tenants (sub-accounts)', superadmin: 'yes', admin: 'no', instructor: 'no', student: 'no' },
  { area: 'Platform', permission: 'Plans, pricing & platform revenue', superadmin: 'yes', admin: 'no', instructor: 'no', student: 'no' },
  { area: 'Platform', permission: 'Create / remove admins & assign roles', superadmin: 'yes', admin: 'no', instructor: 'no', student: 'no' },
  { area: 'Platform', permission: 'White label: brand, custom domain, defaults', superadmin: 'yes', admin: 'partial', instructor: 'no', student: 'no' },
  { area: 'Platform', permission: 'Activity logs, permissions, platform settings', superadmin: 'yes', admin: 'no', instructor: 'no', student: 'no' },

  { area: 'Workspace', permission: 'Dashboard & analytics (own workspace)', superadmin: 'yes', admin: 'yes', instructor: 'partial', student: 'no' },
  { area: 'Workspace', permission: 'Approve / reject instructors', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
  { area: 'Workspace', permission: 'Approve / reject courses', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
  { area: 'Workspace', permission: 'Moderate reviews', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
  { area: 'Workspace', permission: 'Site content, static pages, blog', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
  { area: 'Workspace', permission: 'Coupons & offers (workspace)', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
  { area: 'Workspace', permission: 'Withdrawal approvals', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },

  { area: 'User CRUD', permission: 'List users (directory)', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
  { area: 'User CRUD', permission: 'Invite / create users', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
  { area: 'User CRUD', permission: 'Edit user (name, email, role, status)', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
  { area: 'User CRUD', permission: 'Delete users', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
  { area: 'User CRUD', permission: 'Export users', superadmin: 'yes', admin: 'no', instructor: 'no', student: 'no' },

  { area: 'Instructor', permission: 'Create & edit own courses', superadmin: 'yes', admin: 'yes', instructor: 'yes', student: 'no' },
  { area: 'Instructor', permission: 'Publish courses (subject to approval)', superadmin: 'yes', admin: 'yes', instructor: 'partial', student: 'no' },
  { area: 'Instructor', permission: 'View own wallet & payouts', superadmin: 'yes', admin: 'partial', instructor: 'yes', student: 'no' },
  { area: 'Instructor', permission: 'Respond to course reviews', superadmin: 'yes', admin: 'yes', instructor: 'yes', student: 'no' },

  { area: 'Student', permission: 'Browse & search courses', superadmin: 'yes', admin: 'yes', instructor: 'yes', student: 'yes' },
  { area: 'Student', permission: 'Purchase courses (checkout)', superadmin: 'yes', admin: 'yes', instructor: 'yes', student: 'yes' },
  { area: 'Student', permission: 'Watch lessons, track progress, certificates', superadmin: 'yes', admin: 'yes', instructor: 'yes', student: 'yes' },
  { area: 'Student', permission: 'Write reviews & manage own profile', superadmin: 'yes', admin: 'yes', instructor: 'yes', student: 'yes' },
  { area: 'Student', permission: 'View other students / admin data', superadmin: 'yes', admin: 'yes', instructor: 'no', student: 'no' },
];

const ROLES: { key: RoleKey; label: string; tone: string; dot: string; desc: string }[] = [
  { key: 'superadmin', label: 'Super admin', tone: 'bg-brand text-white', dot: 'bg-white', desc: 'Platform owner — every capability across all workspaces' },
  { key: 'admin', label: 'Admin', tone: 'bg-violet-500/15 text-violet-600', dot: 'bg-violet-500', desc: 'Tenant workspace owner — full control inside their own space' },
  { key: 'instructor', label: 'Instructor', tone: 'bg-amber-500/15 text-amber-600', dot: 'bg-amber-500', desc: 'Course creator — owns their courses, wallet, and student responses' },
  { key: 'student', label: 'Student', tone: 'bg-green-500/15 text-green-600', dot: 'bg-green-500', desc: 'Learner — browses, purchases, watches, and reviews' },
];

const AREAS = [...new Set(MATRIX.map((m) => m.area))];

function CellMark({ v, dimmed }: { v: Cell; dimmed?: boolean }) {
  if (v === 'yes')
    return (
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-500/10 text-green-600 transition ${dimmed ? 'opacity-30' : ''}`}>
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  if (v === 'partial')
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 transition ${dimmed ? 'opacity-30' : ''}`}>
        <Sparkles className="h-2.5 w-2.5" />
        Own only
      </span>
    );
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface text-muted transition ${dimmed ? 'opacity-20' : ''}`}>
      <Minus className="h-3.5 w-3.5" />
    </span>
  );
}

export default function PermissionsPage() {
  const { user, loading } = useAuth();
  const r = useRouter();
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [focusRole, setFocusRole] = useState<RoleKey | null>(null);

  const stats = useMemo(() => {
    const out: Record<RoleKey, { full: number; partial: number; none: number }> = {
      superadmin: { full: 0, partial: 0, none: 0 },
      admin: { full: 0, partial: 0, none: 0 },
      instructor: { full: 0, partial: 0, none: 0 },
      student: { full: 0, partial: 0, none: 0 },
    };
    for (const row of MATRIX) {
      for (const rl of ROLES) {
        const v = row[rl.key];
        if (v === 'yes') out[rl.key].full++;
        else if (v === 'partial') out[rl.key].partial++;
        else out[rl.key].none++;
      }
    }
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MATRIX.filter((m) => {
      if (areaFilter !== 'all' && m.area !== areaFilter) return false;
      if (q && !m.permission.toLowerCase().includes(q) && !m.area.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, areaFilter]);

  const visibleAreas = [...new Set(filtered.map((m) => m.area))];
  const hasActiveFilter = query.trim() !== '' || areaFilter !== 'all';

  if (loading) return <div className="py-20 text-center text-muted">Loading...</div>;
  if (!user || user.principal !== 'admin' || user.adminRole !== 'super_admin') {
    r.push('/login?next=/dashboard/superadmin/permissions');
    return null;
  }

  return (
    <SuperAdminShell>
      <div className="container-page py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Permissions</h1>
              <p className="text-muted">Role-based access matrix — what each principal can do.</p>
            </div>
          </div>
          {hasActiveFilter && (
            <button
              onClick={() => { setQuery(''); setAreaFilter('all'); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>

        {/* Role summary cards — clickable to focus a column */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((rl) => {
            const s = stats[rl.key];
            const active = focusRole === rl.key;
            return (
              <button
                key={rl.key}
                onClick={() => setFocusRole(active ? null : rl.key)}
                className={`card group p-4 text-left transition hover:shadow-lift ${active ? 'ring-2 ring-brand' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${rl.tone}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${rl.dot}`} />
                    {rl.label}
                  </span>
                  {active && <span className="text-[10px] font-bold uppercase tracking-wide text-brand">Focused</span>}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{rl.desc}</p>
                <div className="mt-3 flex items-center gap-3 text-[11px] font-semibold">
                  <span className="text-green-600">{s.full} full</span>
                  <span className="text-amber-600">{s.partial} partial</span>
                  <span className="text-muted">{s.none} none</span>
                </div>
                {/* Mini bar */}
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface">
                  <div className="bg-green-500" style={{ width: `${(s.full / MATRIX.length) * 100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(s.partial / MATRIX.length) * 100}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-surface px-4 py-3 text-xs text-muted">
          <span className="font-bold uppercase tracking-wider text-[10px]">Legend</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10 text-green-600"><Check className="h-3 w-3" strokeWidth={3} /></span>
            Full access
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-600">Own</span>
            Own resources only
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-line/50 text-muted"><Minus className="h-3 w-3" /></span>
            No access
          </span>
          {focusRole && (
            <span className="ml-auto text-brand font-semibold">Showing all roles — focused role is highlighted</span>
          )}
        </div>

        {/* Search + area filter */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search permissions…"
              className="input pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAreaFilter('all')}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                areaFilter === 'all' ? 'bg-brand text-white' : 'border border-line bg-card text-muted hover:text-ink'
              }`}
            >
              All areas
            </button>
            {AREAS.map((a) => (
              <button
                key={a}
                onClick={() => setAreaFilter(areaFilter === a ? 'all' : a)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  areaFilter === a ? 'bg-brand text-white' : 'border border-line bg-card text-muted hover:text-ink'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {hasActiveFilter && (
          <p className="mt-3 text-xs text-muted">
            {filtered.length} of {MATRIX.length} permissions
            {query.trim() && <> matching <span className="font-semibold text-ink">“{query.trim()}””</span></>}
            {areaFilter !== 'all' && <> in <span className="font-semibold text-ink">{areaFilter}</span></>}
          </p>
        )}

        {/* Matrix tables */}
        <div className="mt-5 space-y-5">
          {visibleAreas.length === 0 ? (
            <div className="card py-16 text-center">
              <p className="text-lg font-semibold text-ink">No permissions match</p>
              <p className="mt-1 text-sm text-muted">Try a different search term or clear the area filter.</p>
              <button
                onClick={() => { setQuery(''); setAreaFilter('all'); }}
                className="mt-4 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                Clear filters
              </button>
            </div>
          ) : (
            visibleAreas.map((area) => {
              const rows = filtered.filter((m) => m.area === area);
              return (
                <div key={area} className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{area}</span>
                    <span className="text-[11px] text-muted">{rows.length} permission{rows.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                          <th className="sticky left-0 z-10 bg-card px-5 py-2.5 font-semibold">Permission</th>
                          {ROLES.map((rl) => (
                            <th
                              key={rl.key}
                              className={`w-24 px-3 py-2.5 text-center font-semibold transition ${
                                focusRole && focusRole !== rl.key ? 'opacity-30' : ''
                              } ${focusRole === rl.key ? 'text-brand' : ''}`}
                            >
                              {rl.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {rows.map((m) => (
                          <tr key={m.permission} className="group hover:bg-surface/80">
                            <td className="sticky left-0 z-10 bg-card px-5 py-3 text-ink group-hover:bg-surface/80">{m.permission}</td>
                            {ROLES.map((rl) => (
                              <td
                                key={rl.key}
                                className={`px-3 py-3 text-center transition ${
                                  focusRole && focusRole !== rl.key ? 'opacity-30' : ''
                                } ${focusRole === rl.key ? 'bg-brand/[0.04]' : ''}`}
                              >
                                <CellMark v={m[rl.key]} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Enforcement note */}
        <p className="mt-6 rounded-xl bg-surface p-4 text-xs leading-relaxed text-muted">
          Enforcement lives in the API: every route requires an authenticated principal via JWT guards,
          <code className="mx-1 rounded bg-card px-1.5 py-0.5">@Roles()</code> restricts to admin/student/instructor,
          <code className="mx-1 rounded bg-card px-1.5 py-0.5">@SuperAdmin()</code> locks platform routes to the top tier,
          and tenant-scoped Prisma queries guarantee admins only ever touch their own workspace&apos;s data.
        </p>
      </div>
    </SuperAdminShell>
  );
}
