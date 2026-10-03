'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Megaphone, Palette, Plus, BadgePercent, Trash2, X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth, useBranding } from '@/lib/providers';
import { DirectoryShell } from '@/components/directory-shell';
import { StatTile } from '@/components/stat-tile';
import type {
  Category, Coupon, CouponSummary, DiscountTarget, DiscountType, Offer, Paginated,
} from '@/lib/types';
import { discountLabel } from '@/lib/types';

type Tab = 'coupons' | 'offers';

interface CourseOption { id: number; title: string; price?: number | null }

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'coupons', label: 'Coupon codes', icon: <BadgePercent size={17} /> },
  { key: 'offers', label: 'Offers & flash sales', icon: <Megaphone size={17} /> },
];

const EMPTY_COUPON = {
  code: '',
  description: '',
  type: 'percentage' as DiscountType,
  value: 10,
  minOrderAmount: '',
  maxDiscount: '',
  target: 'all' as DiscountTarget,
  courseIds: [] as number[],
  categoryIds: [] as number[],
  usageLimit: '',
  perUserLimit: 1,
  startsAt: '',
  endsAt: '',
  status: true,
};

const EMPTY_OFFER = {
  title: '',
  subtitle: '',
  description: '',
  banner: '',
  badge: '',
  type: 'percentage' as DiscountType,
  value: 20,
  maxDiscount: '',
  target: 'all' as DiscountTarget,
  courseIds: [] as number[],
  categoryIds: [] as number[],
  priority: 0,
  startsAt: '',
  endsAt: '',
  status: true,
};

export default function AdminCouponsPage() {
  const { user, loading: authLoading } = useAuth();
  const branding = useBranding();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('coupons');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [summary, setSummary] = useState<CouponSummary | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | 'new' | null>(null);
  const [redemptions, setRedemptions] = useState<{ coupon: Coupon; rows: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const currency = branding?.currency ?? 'USD';
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

  const load = useCallback(() =>
    Promise.all([
      api<Coupon[]>('/admin/coupons').then(setCoupons).catch(() => setCoupons([])),
      api<Offer[]>('/admin/offers').then(setOffers).catch(() => setOffers([])),
      api<CouponSummary>('/admin/coupons/summary').then(setSummary).catch(() => setSummary(null)),
      api<Paginated<CourseOption>>('/courses?perPage=100', { auth: false })
        .then((r) => setCourses(r.data ?? []))
        .catch(() => setCourses([])),
      api<Category[]>('/categories', { auth: false }).then(setCategories).catch(() => setCategories([])),
    ]), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.principal !== 'admin') {
      router.push('/login?next=/dashboard/admin/coupons');
      return;
    }
    load().finally(() => setLoading(false));
  }, [user, authLoading]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };

  const toggleCoupon = async (id: number, status: boolean) => {
    await api(`/admin/coupons/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  };

  const toggleOffer = async (id: number, status: boolean) => {
    await api(`/admin/offers/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  };

  const removeCoupon = async (id: number) => {
    if (!confirm('Delete this coupon? Redemptions already recorded are removed with it.')) return;
    await api(`/admin/coupons/${id}`, { method: 'DELETE' });
    load();
  };

  const removeOffer = async (id: number) => {
    if (!confirm('Delete this offer?')) return;
    await api(`/admin/offers/${id}`, { method: 'DELETE' });
    load();
  };

  const showRedemptions = async (coupon: Coupon) => {
    const rows = await api<any[]>(`/admin/coupons/${coupon.id}/redemptions`);
    setRedemptions({ coupon, rows });
  };

  if (authLoading || loading) return <div className="container-page py-20 text-center text-muted">Loading…</div>;

  if (editing) {
    return (
      <CouponEditor
        coupon={editing === 'new' ? null : editing}
        courses={courses}
        categories={categories}
        onDone={() => {
          setEditing(null);
          load();
        }}
        onError={(e) => flash(e)}
      />
    );
  }

  if (editingOffer) {
    return (
      <OfferEditor
        offer={editingOffer === 'new' ? null : editingOffer}
        courses={courses}
        categories={categories}
        onDone={() => {
          setEditingOffer(null);
          load();
        }}
        onError={(e) => flash(e)}
      />
    );
  }

  return (
    <DirectoryShell
      eyebrow="Admin Console"
      sections={[
        {
          heading: 'Sales',
          links: [
            { href: '/dashboard/admin/coupons', label: 'Coupons & Offers', icon: BadgePercent },
            { href: '/dashboard/admin', label: 'Back to Console', icon: LayoutDashboard, match: '' },
          ],
        },
        {
          heading: 'Branding',
          links: [{ href: '/dashboard/admin/white-label', label: 'White-Label & Themes', icon: Palette }],
        },
      ]}
      userName={user?.name ?? 'Admin'}
      userCaption="Tenant admin"
      userImage={user?.image}
      onLogout={() => {
        if (confirm('Sign out?')) router.push('/login');
      }}
    >
      <div style={{ fontFamily: 'var(--font-admin-body)' }}>
        <div className="mx-auto max-w-[1220px]">
          <Link href="/dashboard/admin" className="text-sm text-muted hover:text-brand">← Admin console</Link>
          <header className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[12.5px] font-semibold text-brand">SALES PROMOTIONS</p>
              <h1 className="text-[27px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-admin-display)' }}>
                Coupons & offers
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Coupon codes shoppers enter at checkout, and offers that discount selected courses
                automatically. Exactly one promotion is honoured per order — whichever saves the buyer more.
              </p>
            </div>
            <button
              onClick={() => (tab === 'coupons' ? setEditing('new') : setEditingOffer('new'))}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={17} /> {tab === 'coupons' ? 'New coupon' : 'New offer'}
            </button>
          </header>

          {msg && <p className="mb-4 rounded-xl bg-brand-soft px-4 py-2.5 text-sm font-medium text-brand">{msg}</p>}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Active coupons" value={summary?.activeCoupons ?? 0} hint="Runnable right now" />
            <StatTile label="Active offers" value={summary?.activeOffers ?? 0} hint="Auto-applied sales" />
            <StatTile label="Coupon redemptions" value={summary?.redemptions ?? 0} hint="Completed orders" />
            <StatTile
              label="Revenue given back"
              value={fmt(summary?.revenueSaved ?? 0)}
              hint={`Avg ${fmt(summary?.averageSaving ?? 0)} per order`}
            />
          </section>

          <div className="mt-7 flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-5 py-2.5 text-sm font-medium transition ${
                  tab === t.key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === 'coupons' ? (
              <CouponTable
                coupons={coupons}
                courses={courses}
                fmt={fmt}
                onNew={() => setEditing('new')}
                onEdit={setEditing}
                onToggle={toggleCoupon}
                onRemove={removeCoupon}
                onRedemptions={showRedemptions}
              />
            ) : (
              <OfferTable
                offers={offers}
                fmt={fmt}
                onNew={() => setEditingOffer('new')}
                onEdit={setEditingOffer}
                onToggle={toggleOffer}
                onRemove={removeOffer}
              />
            )}
          </div>
        </div>
      </div>

      {redemptions && (
        <RedemptionModal
          coupon={redemptions.coupon}
          rows={redemptions.rows}
          fmt={fmt}
          onClose={() => setRedemptions(null)}
        />
      )}
    </DirectoryShell>
  );
}

/* ─── Tables ─────────────────────────────────────────────────────────────── */

function CouponTable({
  coupons, courses, fmt, onNew, onEdit, onToggle, onRemove, onRedemptions,
}: {
  coupons: Coupon[];
  courses: CourseOption[];
  fmt: (n: number) => string;
  onNew: () => void;
  onEdit: (c: Coupon) => void;
  onToggle: (id: number, status: boolean) => void;
  onRemove: (id: number) => void;
  onRedemptions: (c: Coupon) => void;
}) {
  const titleOf = useMemo(() => {
    const map = new Map(courses.map((c) => [c.id, c.title]));
    return (id: number) => map.get(id) ?? `Course #${id}`;
  }, [courses]);

  if (coupons.length === 0) {
    return <EmptyState icon={<BadgePercent size={22} />} title="No coupons yet" body="Create a code like WELCOME10 and shoppers can redeem it in the cart." actionLabel="Create your first coupon" onAction={onNew} />;
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
          <tr>
            <th className="px-5 py-3 font-semibold">Code</th>
            <th className="px-5 py-3 font-semibold">Discount</th>
            <th className="px-5 py-3 font-semibold">Applies to</th>
            <th className="px-5 py-3 font-semibold">Window</th>
            <th className="px-5 py-3 font-semibold">Used</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {coupons.map((c) => (
            <tr key={c.id} className="align-top">
              <td className="px-5 py-4">
                <span className="font-mono text-[13px] font-bold tracking-wide text-ink">{c.code}</span>
                {c.description && <p className="mt-0.5 max-w-[220px] text-xs text-muted">{c.description}</p>}
              </td>
              <td className="px-5 py-4">
                <span className="font-bold text-brand">{discountLabel(c.type, c.value)}</span>
                {c.maxDiscount != null && <p className="text-xs text-muted">max {fmt(c.maxDiscount)}</p>}
                {c.minOrderAmount != null && <p className="text-xs text-muted">min {fmt(c.minOrderAmount)}</p>}
              </td>
              <td className="px-5 py-4 text-muted">
                {c.target === 'all' && 'Every course'}
                {c.target === 'courses' && `${c.courseIds.length} course(s)`}
                {c.target === 'categories' && `${c.categoryIds.length} categor(ies)`}
                {c.target === 'courses' && c.courseIds.length > 0 && (
                  <p className="mt-0.5 max-w-[200px] truncate text-xs">{c.courseIds.map(titleOf).join(', ')}</p>
                )}
              </td>
              <td className="px-5 py-4 text-xs text-muted">
                {c.startsAt ? new Date(c.startsAt).toLocaleDateString() : 'Anytime'}
                {' → '}
                {c.endsAt ? new Date(c.endsAt).toLocaleDateString() : 'No end'}
                <p className="mt-0.5">{c.perUserLimit} per buyer</p>
              </td>
              <td className="px-5 py-4">
                <span className="font-semibold text-ink">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</span>
                {c._count && c._count.redemptions > 0 && (
                  <button onClick={() => onRedemptions(c)} className="mt-0.5 block text-xs text-brand hover:underline">
                    View redemptions
                  </button>
                )}
              </td>
              <td className="px-5 py-4">
                <button
                  onClick={() => onToggle(c.id, !c.status)}
                  className={`badge ${c.status ? 'bg-green-500/15 text-green-600' : 'bg-line text-muted'}`}
                >
                  {c.status ? 'Active' : 'Paused'}
                </button>
              </td>
              <td className="px-5 py-4 text-right">
                <button onClick={() => onEdit(c)} className="text-sm text-brand hover:underline">Edit</button>
                <button onClick={() => onRemove(c.id)} className="ml-3 text-sm text-red-500 hover:underline">
                  <Trash2 size={15} className="inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OfferTable({
  offers, fmt, onNew, onEdit, onToggle, onRemove,
}: {
  offers: Offer[];
  fmt: (n: number) => string;
  onNew: () => void;
  onEdit: (o: Offer) => void;
  onToggle: (id: number, status: boolean) => void;
  onRemove: (id: number) => void;
}) {
  if (offers.length === 0) {
    return <EmptyState icon={<Megaphone size={22} />} title="No offers yet" body="An offer discounts selected courses automatically during a sale window — no code needed." actionLabel="Create your first offer" onAction={onNew} />;
  }

  const now = Date.now();
  const live = (o: Offer) =>
    o.status && (!o.startsAt || new Date(o.startsAt).getTime() <= now) && (!o.endsAt || new Date(o.endsAt).getTime() > now);

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
          <tr>
            <th className="px-5 py-3 font-semibold">Offer</th>
            <th className="px-5 py-3 font-semibold">Discount</th>
            <th className="px-5 py-3 font-semibold">Applies to</th>
            <th className="px-5 py-3 font-semibold">Window</th>
            <th className="px-5 py-3 font-semibold">Sold</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {offers.map((o) => (
            <tr key={o.id} className="align-top">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">{o.title}</span>
                  {o.badge && <span className="badge bg-brand-soft text-brand">{o.badge}</span>}
                </div>
                {o.subtitle && <p className="mt-0.5 max-w-[240px] text-xs text-muted">{o.subtitle}</p>}
              </td>
              <td className="px-5 py-4">
                <span className="font-bold text-brand">{discountLabel(o.type, o.value)}</span>
                {o.maxDiscount != null && <p className="text-xs text-muted">max {fmt(o.maxDiscount)}</p>}
              </td>
              <td className="px-5 py-4 text-muted">
                {o.target === 'all' && 'Every course'}
                {o.target === 'courses' && `${o.courseIds.length} course(s)`}
                {o.target === 'categories' && `${o.categoryIds.length} categor(ies)`}
              </td>
              <td className="px-5 py-4 text-xs text-muted">
                {o.startsAt ? new Date(o.startsAt).toLocaleDateString() : 'Anytime'}
                {' → '}
                {o.endsAt ? new Date(o.endsAt).toLocaleDateString() : 'No end'}
                <p className="mt-0.5">priority {o.priority}</p>
              </td>
              <td className="px-5 py-4 font-semibold text-ink">{o.usedCount}</td>
              <td className="px-5 py-4">
                <button
                  onClick={() => onToggle(o.id, !o.status)}
                  className={`badge ${live(o) ? 'bg-green-500/15 text-green-600' : 'bg-amber-500/15 text-amber-600'}`}
                >
                  {live(o) ? 'Live' : o.status ? 'Scheduled' : 'Paused'}
                </button>
              </td>
              <td className="px-5 py-4 text-right">
                <button onClick={() => onEdit(o)} className="text-sm text-brand hover:underline">Edit</button>
                <button onClick={() => onRemove(o.id)} className="ml-3 text-sm text-red-500 hover:underline">
                  <Trash2 size={15} className="inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Editors ────────────────────────────────────────────────────────────── */

function CouponEditor({
  coupon, courses, categories, onDone, onError,
}: {
  coupon: Coupon | null;
  courses: CourseOption[];
  categories: Category[];
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState(() =>
    coupon
      ? {
          ...EMPTY_COUPON,
          code: coupon.code,
          description: coupon.description ?? '',
          type: coupon.type,
          value: coupon.value,
          minOrderAmount: coupon.minOrderAmount?.toString() ?? '',
          maxDiscount: coupon.maxDiscount?.toString() ?? '',
          target: coupon.target,
          courseIds: coupon.courseIds ?? [],
          categoryIds: coupon.categoryIds ?? [],
          usageLimit: coupon.usageLimit?.toString() ?? '',
          perUserLimit: coupon.perUserLimit ?? 1,
          startsAt: toDateInput(coupon.startsAt),
          endsAt: toDateInput(coupon.endsAt),
          status: coupon.status,
        }
      : EMPTY_COUPON,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!form.code.trim()) return setErr('A coupon needs a code');
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        value: Number(form.value),
        minOrderAmount: form.minOrderAmount === '' ? null : Number(form.minOrderAmount),
        maxDiscount: form.maxDiscount === '' ? null : Number(form.maxDiscount),
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        perUserLimit: Number(form.perUserLimit) || 1,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      };
      if (coupon) await api(`/admin/coupons/${coupon.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/admin/coupons', { method: 'POST', body: JSON.stringify(payload) });
      onDone();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Could not save the coupon';
      setErr(message);
      onError(message);
      setBusy(false);
    }
  };

  return (
    <div className="container-page max-w-4xl py-10">
      <button onClick={onDone} className="text-sm text-muted hover:text-brand">← Coupons & offers</button>
      <h1 className="mt-3 text-3xl font-extrabold">{coupon ? `Edit ${coupon.code}` : 'New coupon'}</h1>

      <div className="mt-6 space-y-6">
        <section className="card space-y-5 p-6">
          <h2 className="font-bold">The code</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Code" hint="Letters, numbers and dashes. Stored uppercase.">
              <input
                className="input font-mono uppercase"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="WELCOME10"
              />
            </Field>
            <Field label="Internal note" hint="Only admins see this.">
              <input
                className="input"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="October newsletter"
              />
            </Field>
          </div>
        </section>

        <section className="card space-y-5 p-6">
          <h2 className="font-bold">The discount</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Type">
              <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DiscountType }))}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </Field>
            <Field label={form.type === 'percentage' ? 'Percent off (1–100)' : 'Amount off'}>
              <input
                type="number"
                min={0}
                max={form.type === 'percentage' ? 100 : undefined}
                className="input"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Maximum discount" hint="Caps what a percentage takes off one order.">
              <input
                type="number"
                min={0}
                className="input"
                value={form.maxDiscount}
                onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Minimum order" hint="Cart must reach this to qualify.">
              <input
                type="number"
                min={0}
                className="input"
                value={form.minOrderAmount}
                onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                placeholder="Optional"
              />
            </Field>
          </div>
        </section>

        <TargetPicker
          target={form.target}
          courseIds={form.courseIds}
          categoryIds={form.categoryIds}
          courses={courses}
          categories={categories}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />

        <section className="card space-y-5 p-6">
          <h2 className="font-bold">Limits & window</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Total uses" hint="Blank = unlimited.">
              <input
                type="number"
                min={1}
                className="input"
                value={form.usageLimit}
                onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                placeholder="Unlimited"
              />
            </Field>
            <Field label="Uses per buyer">
              <input
                type="number"
                min={1}
                className="input"
                value={form.perUserLimit}
                onChange={(e) => setForm((f) => ({ ...f, perUserLimit: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Starts">
              <input type="date" className="input" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
            </Field>
            <Field label="Ends">
              <input type="date" className="input" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked }))} />
            Active — students can redeem this code now
          </label>
        </section>

        {err && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{err}</p>}

        <div className="flex gap-3">
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : coupon ? 'Save changes' : 'Create coupon'}
          </button>
          <button onClick={onDone} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function OfferEditor({
  offer, courses, categories, onDone, onError,
}: {
  offer: Offer | null;
  courses: CourseOption[];
  categories: Category[];
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState(() =>
    offer
      ? {
          ...EMPTY_OFFER,
          title: offer.title,
          subtitle: offer.subtitle ?? '',
          description: offer.description ?? '',
          banner: offer.banner ?? '',
          badge: offer.badge ?? '',
          type: offer.type,
          value: offer.value,
          maxDiscount: offer.maxDiscount?.toString() ?? '',
          target: offer.target,
          courseIds: offer.courseIds ?? [],
          categoryIds: offer.categoryIds ?? [],
          priority: offer.priority ?? 0,
          startsAt: toDateInput(offer.startsAt),
          endsAt: toDateInput(offer.endsAt),
          status: offer.status,
        }
      : EMPTY_OFFER,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!form.title.trim()) return setErr('An offer needs a title');
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        value: Number(form.value),
        maxDiscount: form.maxDiscount === '' ? null : Number(form.maxDiscount),
        priority: Number(form.priority) || 0,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      };
      if (offer) await api(`/admin/offers/${offer.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/admin/offers', { method: 'POST', body: JSON.stringify(payload) });
      onDone();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Could not save the offer';
      setErr(message);
      onError(message);
      setBusy(false);
    }
  };

  return (
    <div className="container-page max-w-4xl py-10">
      <button onClick={onDone} className="text-sm text-muted hover:text-brand">← Coupons & offers</button>
      <h1 className="mt-3 text-3xl font-extrabold">{offer ? `Edit ${offer.title}` : 'New offer'}</h1>
      <p className="mt-1 text-sm text-muted">
        Offers apply themselves during the sale window — shoppers pay the discounted price without entering anything.
      </p>

      <div className="mt-6 space-y-6">
        <section className="card space-y-5 p-6">
          <h2 className="font-bold">Storefront copy</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Title">
              <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Launch Week" />
            </Field>
            <Field label="Badge" hint="Short pill shown on the offer card, e.g. FLASH SALE.">
              <input className="input" value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} placeholder="FLASH SALE" />
            </Field>
          </div>
          <Field label="Subtitle">
            <input className="input" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="Half price on selected courses" />
          </Field>
          <Field label="Description">
            <textarea className="input min-h-[90px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
        </section>

        <section className="card space-y-5 p-6">
          <h2 className="font-bold">The discount</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Type">
              <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DiscountType }))}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </Field>
            <Field label={form.type === 'percentage' ? 'Percent off (1–100)' : 'Amount off'}>
              <input
                type="number"
                min={0}
                max={form.type === 'percentage' ? 100 : undefined}
                className="input"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Maximum discount">
              <input type="number" min={0} className="input" value={form.maxDiscount} onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))} placeholder="Optional" />
            </Field>
            <Field label="Priority" hint="Higher wins when several offers overlap.">
              <input type="number" className="input" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} />
            </Field>
          </div>
        </section>

        <TargetPicker
          target={form.target}
          courseIds={form.courseIds}
          categoryIds={form.categoryIds}
          courses={courses}
          categories={categories}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />

        <section className="card space-y-5 p-6">
          <h2 className="font-bold">Sale window</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Starts">
              <input type="date" className="input" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
            </Field>
            <Field label="Ends">
              <input type="date" className="input" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked }))} />
            Active — this offer can discount checkouts
          </label>
        </section>

        {err && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{err}</p>}

        <div className="flex gap-3">
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : offer ? 'Save changes' : 'Create offer'}
          </button>
          <button onClick={onDone} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared form pieces ─────────────────────────────────────────────────── */

function TargetPicker({
  target, courseIds, categoryIds, courses, categories, onChange,
}: {
  target: DiscountTarget;
  courseIds: number[];
  categoryIds: number[];
  courses: CourseOption[];
  categories: Category[];
  onChange: (patch: Partial<{ target: DiscountTarget; courseIds: number[]; categoryIds: number[] }>) => void;
}) {
  const [filter, setFilter] = useState('');

  const toggleCourse = (id: number) =>
    onChange({ courseIds: courseIds.includes(id) ? courseIds.filter((c) => c !== id) : [...courseIds, id] });
  const toggleCategory = (id: number) =>
    onChange({ categoryIds: categoryIds.includes(id) ? categoryIds.filter((c) => c !== id) : [...categoryIds, id] });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? courses.filter((c) => c.title.toLowerCase().includes(q)) : courses;
  }, [courses, filter]);

  return (
    <section className="card space-y-5 p-6">
      <div>
        <h2 className="font-bold">Who it applies to</h2>
        <p className="mt-0.5 text-sm text-muted">
          Narrow the promotion to a hand-picked set of courses or whole categories — the usual way to run a
          flash sale without discounting your whole catalog.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'courses', 'categories'] as DiscountTarget[]).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ target: t })}
            className={`btn text-sm ${target === t ? 'bg-brand text-white' : 'border border-line'}`}
          >
            {t === 'all' ? 'Every course' : t === 'courses' ? 'Selected courses' : 'Selected categories'}
          </button>
        ))}
      </div>

      {target === 'courses' && (
        <div className="space-y-3">
          <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter courses…" />
          <p className="text-xs text-muted">{courseIds.length} selected</p>
          <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {visible.length === 0 && <p className="p-4 text-sm text-muted">No courses match that filter.</p>}
            {visible.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface">
                <input type="checkbox" checked={courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                <span className="flex-1 truncate">{c.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {target === 'categories' && (
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && <p className="text-sm text-muted">No categories yet.</p>}
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleCategory(c.id)}
              className={`btn text-sm ${categoryIds.includes(c.id) ? 'bg-brand text-white' : 'border border-line'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function RedemptionModal({
  coupon, rows, fmt, onClose,
}: {
  coupon: Coupon;
  rows: any[];
  fmt: (n: number) => string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold">{coupon.code} redemptions</h2>
            <p className="mt-1 text-sm text-muted">
              {rows.length} order(s) · {discountLabel(coupon.type, coupon.value)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface"><X size={18} /></button>
        </div>

        <div className="mt-5 max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {rows.length === 0 && <p className="p-5 text-sm text-muted">No one has used this coupon yet.</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-ink">Order #{r.orderId} · user #{r.userId}</p>
                <p className="text-xs text-muted">{r.courseCount} course(s) · {new Date(r.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">-{fmt(r.amount)}</p>
                <p className="text-xs text-muted">paid {fmt(r.orderTotal)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon, title, body, actionLabel, onAction,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">{icon}</span>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <p className="max-w-md text-sm text-muted">{body}</p>
      <button onClick={onAction} className="btn-primary mt-2 inline-flex items-center gap-2">
        <Plus size={16} /> {actionLabel}
      </button>
    </div>
  );
}

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** `<input type="date">` needs yyyy-mm-dd, not an ISO timestamp. */
function toDateInput(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
