# Leads, Resellers & Revenue — how it works

How the three Super-Admin data streams are captured, stored, and aggregated.
Everything is real data from Postgres — **no frontend mock data**. Figures on the
dashboards are computed from the DB; the values you see locally come from what
you imported (`npm run db:seed` loads demo orders/leads/resellers), and in
production they come from live transactions.

```
Marketing site forms            Stripe webhooks                Stripe webhooks
(start trial / contact /        (course checkout)              (plan subscription)
 pricing)
        │                              │                              │
        ▼                              ▼                              ▼
  POST /leads  ──────►  leads        orders (approved)      subscriptions (active)
        │                              │                              │
        ▼                              ▼                              ▼
  Super-admin pipeline       GET /admin/tenants/platform-stats ─┴──►  Super-admin
  (status workflow)          + /admin/platform/revenue                revenue page
```

---

## 1. Leads (sales pipeline)

**Purpose:** every site visitor who starts a free trial, asks for pricing, or
uses the contact form becomes a lead that Super Admins track until it is either
converted into a tenant or closed.

**Model** — `Lead` (`apps/api/prisma/schema.prisma:1133`):

| Field     | Meaning                                                      |
|-----------|--------------------------------------------------------------|
| `name`, `email`, `company`, `phone`, `message` | contact details        |
| `source`  | `trial` \| `contact` \| `pricing` — which form captured it      |
| `status`  | `new` → `contacted` → `converted` \| `closed` (workflow state)  |

**Flow**

1. **Capture (public, no auth):** `POST /leads` (`LeadsPublicController`,
   `apps/api/src/leads/leads.module.ts`). The marketing-site forms call this.
   Created leads always start as `new`.
2. **Read:** `GET /admin/leads?status=…` — Super Admin only. Returns the newest
   200 leads, optionally filtered by status.
3. **Move the pipeline:** `PUT /admin/leads/:id/status` with
   `new | contacted | converted | closed`. Every status change is written to
   `audit_logs` (`action = "lead.status"`) so the trail in
   `/dashboard/superadmin/logs` shows who advanced which lead.
4. **Conversion is manual by design.** When a lead actually purchases, the
   Super Admin creates the tenant via `POST /admin/tenants`
   (`TenantsService.create`) and then marks the lead `converted`. The system
   does not auto-provision tenants from leads.

Security: the public endpoint only accepts the DTO fields and lowercases the
email; listing/status changes require `@SuperAdmin()`.

---

## 2. Resellers (partner channel)

**Purpose:** agencies that re-sell tenant subscriptions earn a share of
platform revenue. Super Admin manages them and their commission payouts.

**Models**

- `Reseller` (`schema.prisma:1068`): `name`, `email` (unique), `phone`,
  `companyName`, `commissionRate` (percent of tenant-plan sales, default 20),
  `status` (`active` | `suspended`), `totalEarned`.
- `ResellerPayout` (`schema.prisma:1085`): an amount row per reseller with
  `status` (`pending` | `paid`) and an optional `note`.

**Flow (`apps/api/src/resellers/resellers.module.ts`, all `@SuperAdmin()`)**

| Action | Endpoint | What it does |
|---|---|---|
| List partners | `GET /admin/resellers` | incl. 5 most recent payouts each |
| Create partner | `POST /admin/resellers` | defaults `commissionRate` 20 % |
| Edit / suspend | `PUT /admin/resellers/:id` | partial update incl. `status` |
| Delete | `DELETE /admin/resellers/:id` | cascades their payout rows |
| Record payout | `POST /admin/resellers/:id/payouts` | creates payout (`pending`) and **increments `totalEarned`** in one transaction |
| List payouts | `GET /admin/resellers/:id/payouts` | full payout history |
| Settle payout | `PUT /admin/resellers/payouts/:payoutId/settle` | flips `pending` → `paid` |

Each mutation is audit-logged (`reseller.create`, `reseller.update`,
`reseller.suspend`, `reseller.delete`, `reseller.payout`).

**Semantics of money:** `totalEarned` is credited when a payout is *recorded*
(commission due), and the row stays `pending` until the Super Admin actually
settles it — so `sum(pending payouts)` = unsettled commission and
`sum(paid payouts)` = cash already sent.

**Known gap (documented, intentional for now):** commissions are **not yet
accrued automatically** from subscription invoices. `commissionRate` is stored
and the payout ledger is fully working, but nothing computes
`invoiceTotal × commissionRate` when a tenant pays via Stripe. When automated
accrual is added it should hook into the billing webhook
(`apps/api/src/billing/billing.module.ts`, `customer.subscription.updated` /
checkout completion) and add the same `resellerPayout` rows instead of manual
entry — the settlement flow then stays unchanged.

---

## 3. Revenue (platform figures)

**Purpose:** the Super-Admin revenue page
(`/dashboard/superadmin/revenue`) surfaces how much the platform earns and
where it comes from. The page is currently a guarded stub; these are the
figures it will render and the exact queries behind each.

### Where money actually enters the system

There are **two** Stripe money-in paths, with separate webhooks on purpose:

| Path | Trigger | Record created |
|---|---|---|
| **Course sales** (tenant-scale commerce) | Stripe checkout of a course order | `Order` (`status: approved`, `paidAmount`, coupon/offer reductions, `OrderItem`s incl. `commissionRate` per item) — activated by the `/checkout/webhook` handler in the orders module |
| **Platform plan subscriptions** (SaaS fees) | Stripe checkout for a tenant's plan | `Subscription` (`status: active`, linked `Plan.priceMonthly`) — activated by `/billing/webhook` (`checkout.session.completed` → `BillingService.activateFromCheckout`) |

Failed/forgotten payments flip tenants + subscriptions to `past_due` via the
`invoice.payment_failed` webhook, and cancellations to `canceled` +
suspended tenants — so "active" always means "currently paying".

### Figures and their sources

| Figure | Source (all via `RAW_PRISMA`, cross-tenant read) |
|---|---|
| **MRR** | `sum(plan.priceMonthly)` over `subscriptions` where `status = 'active'`; `priceMonthly` is stored in **minor units (cents)** and divided by 100 (see `TenantsService.platformStats`, `apps/api/src/tenants/tenants.module.ts:160`) |
| **Revenue by plan** | `plan._count.subscriptions` per plan (tenant count, drives the revenue-mix chart) |
| **GMV / course revenue** | `sum(order.paidAmount)` over `orders` where `status = 'approved'` |
| **Revenue trend (last N days)** | approved orders bucketed per day (`order.createdAt`), same aggregation as `DashboardService.adminAnalytics` (`apps/api/src/dashboard/dashboard.module.ts:62`) but cross-tenant |
| **Instructor payouts** | `Withdraw` rows and wallet balances — money leaving tenant instructors |
| **Reseller payouts** | `ResellerPayout` rows — commission owed/paid by the platform |

### What the revenue page will display

1. **KPI row** — MRR, course GMV, approved orders, revenue trend % change
   (current 30-day total vs. the total as of 30 days ago, like `admin()` does
   for the admin dashboard).
2. **Revenue trend chart** — daily `paidAmount` buckets for the last 30 days,
   cross-tenant.
3. **Revenue by plan table/mix** — plan name, subscription count, implied MRR
   contribution (`priceMonthly × count`).
4. **Payouts panel** — pending vs. paid reseller payouts and instructor
   withdrawals, with settlement actions linking to
   `/dashboard/superadmin/resellers`.

### Planned endpoint

`GET /admin/platform/revenue` (Super Admin, in `TenantsModule` alongside the
existing `GET /admin/platform/stats`) returns:

```jsonc
{
  "mrr": 289.0,            // major units
  "gmv": 1234.56,          // approved-order paidAmount sum
  "orders": 42,
  "trends": { "mrr": 4.2, "gmv": 11.5 },
  "revenueByDay": [{ "date": "2026-10-01", "amount": 89.99 }],
  "revenueByPlan": [{ "name": "Pro", "workspaces": 3, "mrr": 189.0 }],
  "payouts": {
    "resellers": { "pending": 250.0, "paid": 1050.0 },
    "instructors": { "pending": 120.0, "paid": 400.0 }
  }
}
```

All numbers are computed with Prisma `groupBy`/`aggregate` at request time —
no cached or hardcoded totals, so they move as soon as orders/subscription
status change.

### About "mock data"

- The **seed script** (`apps/api/prisma/seed.ts:316`) inserts 12 real `Order`
  rows (`INV-0001…`, approved, `paidAmount` = discounted course price) across
  Acme's students and courses, plus leads and resellers, purely so you can see
  the figures after `npm run db:seed`. They use the same schema as production
  data — the only marker is the `transactionId` (`txn_mock_…`), which real
  sales replace with actual Stripe transaction IDs.
- No dashboard component contains hardcoded/fallback revenue numbers; every
  value renders from an API response (`stats?.… ?? 0` only guards *loading*,
  it never fabricates data). Adding a fixture-backed mock to any revenue,
  reseller or leads UI is explicitly off-limits.

---

## Related reading

- Tenant plans & Stripe flows: `apps/api/src/billing/` (`/billing/me`,
  `/billing/checkout`, `/billing/portal`, `/billing/webhook`)
- Tenant lifecycle: `apps/api/src/tenants/tenants.module.ts`
- Order approval & checkout: `apps/api/src/orders/` (`/checkout/webhook`)
- Printed seed credentials: end of `apps/api/prisma/seed.ts` (`console.log` block)
