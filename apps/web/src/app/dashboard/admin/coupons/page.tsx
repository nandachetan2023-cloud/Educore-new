'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgePercent, LayoutDashboard, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';
import { StatTile } from '@/components/stat-tile';
import type { Coupon, CouponSummary, Paginated } from '@/lib/types';
import { discountLabel } from '@/lib/types';

interface CourseMap { id: number; title: string }

/** Coupon builder presets — one click prefills the create form. */
const COUPON_PRESETS = [
  { name: 'Welcome offer', template: { code: 'WELCOME20', description: '20% off for new students', type: 'percentage' as const, value: 20, minOrderAmount: null, maxDiscount: 50, target: 'all' as const, perUserLimit: 1, status: true } },
  { name: 'Flat saving', template: { code: 'SAVE50', description: 'Flat $50 off larger orders', type: 'fixed' as const, value: 50, minOrderAmount: 200, maxDiscount: null, target: 'all' as const, perUserLimit: 1, status: true } },
  { name: 'Student discount', template: { code: 'STUDENT15', description: '15% for any course, twice per user', type: 'percentage' as const, value: 15, minOrderAmount: null, maxDiscount: 30, target: 'courses' as const, perUserLimit: 2, status: true } },
  { name: 'Season sale', template: { code: 'SEASON30', description: '30% limited-time sale, capped', type: 'percentage' as const, value: 30, minOrderAmount: null, maxDiscount: 100, target: 'all' as const, perUserLimit: 1, status: true } },
  { name: 'Big order bonus', template: { code: 'BONUS25', description: '25% off orders above $100', type: 'percentage' as const, value: 25, minOrderAmount: 100, maxDiscount: 75, target: 'all' as const, perUserLimit: 1, status: true } },
  { name: 'Course voucher', template: { code: 'VOUCHER', description: 'Fixed $10 course voucher', type: 'fixed' as const, value: 10, minOrderAmount: null, maxDiscount: null, target: 'courses' as const, perUserLimit: 1, status: true } },
];

/**
 * Admin-owned coupons: Admins can create, edit and delete coupons for their
 * workspace. Coupons are active by default. Super Admin can schedule a future
 * deactivation only via the Super Admin console.
 */
export default function MyCouponsPage() {
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [summary, setSummary] = useState<CouponSummary | null>(null);
  const [courses, setCourses] = useState<CourseMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<Partial<Coupon>>({ type: 'percentage', value: 10, target: 'all', perUserLimit: 1, status: true });

  const currency = branding?.currency ?? 'USD';
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

  const refresh = async () => {
    const c = await api<Coupon[]>('/admin/coupons');
    setCoupons(c);
    const s = await api<CouponSummary>('/admin/coupons/summary');
    setSummary(s);
  };

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

  const openNew = () => { setEditing(null); setForm({ type: 'percentage', value: 10, target: 'all', perUserLimit: 1, status: true, code: '', description: '', courseIds: [], categoryIds: [] }); setShowForm(true); };
  const openEdit = (c: Coupon) => { setEditing(c); setForm({ ...c }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };
  const saveCoupon = async () => {
    if (!form.code || !form.type || form.value == null || !form.target) return;
    if (editing?.id) {
      await api(`/admin/coupons/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
    } else {
      await api('/admin/coupons', { method: 'POST', body: JSON.stringify(form) });
    }
    closeForm();
    await refresh();
  };
  const deleteCoupon = async (id: number) => {
    if (!confirm('Delete this coupon?')) return;
    await api(`/admin/coupons/${id}`, { method: 'DELETE' });
    await refresh();
  };

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
          <header className="mb-6 mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[12.5px] font-semibold text-brand">SALES PROMOTIONS</p>
              <h1 className="text-[27px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-admin-display)' }}>Coupons</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Create, edit and delete coupon codes for your workspace. Coupons are active by default. The Super Admin can schedule a future deactivation only.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost gap-1.5" onClick={() => setShowPresets((s) => !s)}>
                <Sparkles size={15} /> Coupon builder
              </button>
              <button className="btn-primary" onClick={openNew}>New coupon</button>
            </div>
          </header>

          {showPresets && (
            <section className="mb-6 rounded-2xl border border-[#EAE6DB] bg-white p-5">
              <h2 className="font-semibold">Pick a coupon template</h2>
              <p className="mt-1 text-sm text-muted">One click prefills the form — edit the code or limits, then Create.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {COUPON_PRESETS.map((p) => (
                  <button
                    key={p.template.code}
                    disabled={editing != null}
                    className="text-left rounded-xl border border-[#EAE6DB] bg-[#FAF8F2] p-4 transition hover:border-brand/50 hover:bg-white disabled:opacity-50"
                    onClick={() => {
                      setEditing(null);
                      setForm({ courseIds: [], categoryIds: [], ...p.template });
                      setShowPresets(false);
                      setShowForm(true);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{p.name}</span>
                      <span className="rounded-md bg-brand/10 px-2 py-0.5 font-mono text-xs font-bold text-brand">{p.template.code}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{p.template.description}</p>
                    <p className="mt-2 text-sm font-bold text-brand">
                      {discountLabel(p.template.type, p.template.value)}
                      {p.template.maxDiscount != null && <span className="ml-1 text-xs font-normal text-muted">max ${p.template.maxDiscount}</span>}
                      {p.template.minOrderAmount != null && <span className="ml-1 text-xs font-normal text-muted">min ${p.template.minOrderAmount}</span>}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

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
                      <th className="px-5 py-3 text-right">Actions</th>
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
                        <td className="px-5 py-4 text-right">
                          <button className="text-sm text-brand mr-3" onClick={() => openEdit(c)}>Edit</button>
                          <button className="text-sm text-red-600" onClick={() => deleteCoupon(c.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {coupons?.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-[#93897B]">
                          No coupons yet — create your first one.
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
      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">{editing ? 'Edit coupon' : 'New coupon'}</h2>
            <div className="mt-4 grid gap-3">
              <label className="block text-sm">Code
                <input className="input mt-1" value={form.code ?? ''} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} />
              </label>
              <label className="block text-sm">Description
                <input className="input mt-1" value={form.description ?? ''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">Type
                  <select className="input mt-1" value={form.type ?? 'percentage'} onChange={e=>setForm(f=>({...f,type:e.target.value as any}))}>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>
                <label className="block text-sm">Value
                  <input type="number" className="input mt-1" value={form.value ?? 0} onChange={e=>setForm(f=>({...f,value:Number(e.target.value)}))} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">Min order
                  <input type="number" className="input mt-1" value={form.minOrderAmount ?? ''} onChange={e=>setForm(f=>({...f,minOrderAmount:e.target.value?Number(e.target.value):null}))} />
                </label>
                <label className="block text-sm">Max discount
                  <input type="number" className="input mt-1" value={form.maxDiscount ?? ''} onChange={e=>setForm(f=>({...f,maxDiscount:e.target.value?Number(e.target.value):null}))} />
                </label>
              </div>
              <label className="block text-sm">Target
                <select className="input mt-1" value={form.target ?? 'all'} onChange={e=>setForm(f=>({...f,target:e.target.value as any}))}>
                  <option value="all">All</option>
                  <option value="courses">Courses</option>
                  <option value="categories">Categories</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.status ?? true} onChange={e=>setForm(f=>({...f,status:e.target.checked}))} />
                Active
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn" onClick={closeForm}>Cancel</button>
              <button className="btn-primary" onClick={saveCoupon}>{editing ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </DirectoryShell>
  );
}
