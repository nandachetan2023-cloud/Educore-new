# EduCore Node

A white-label LMS / online course marketplace — a Node.js (NestJS + Next.js) port of the original EduCore Laravel platform.

> **Status: feature-complete core, verified running live.** The full stack has been run end-to-end against a live PostgreSQL database — the whole lifecycle passes: instructor creates a course → admin approves → student enrolls (free or Stripe) → completes lessons → progress hits 100% → certificate. Auth (3 roles), commerce, course player, admin console, instructor course-builder, payouts, certificates (PDF), file uploads, SMTP mail, CMS content blocks, and a blog are all implemented; both apps build clean. Remaining before calling it production-ready: versioned migrations, automated test suite, CI, and an S3 upload driver. See [Roadmap](#roadmap).

## Stack

| Layer    | Choice                                   |
| -------- | ---------------------------------------- |
| API      | NestJS 10 + TypeScript                   |
| ORM      | Prisma 5 (PostgreSQL)                    |
| Auth     | JWT (access + refresh), Argon2 hashing   |
| Frontend | Next.js (App Router) — _scaffold pending_|
| Payments | Stripe → PayPal → Razorpay _(roadmap)_   |

## Layout

```
educore-node/
├─ apps/
│  ├─ api/            NestJS API
│  │  ├─ prisma/      schema.prisma (45 models), seed.ts
│  │  └─ src/         auth, courses, categories, health, common, prisma
│  └─ web/            Next.js frontend (pending)
├─ docker-compose.yml MySQL + Adminer + API
└─ .env.example
```

## Quick start

### Option A — Docker (recommended)

```bash
cp .env.example .env          # then edit secrets
docker compose up --build      # API on :4000, Adminer on :8080
```

### Option B — Local

```bash
cp .env.example .env
npm install
# Point DATABASE_URL at your PostgreSQL, create the `educore` database, then:
cd apps/api
npx prisma db push        # create tables from schema
npm run prisma:seed       # demo admin/instructor/student + taxonomy
npm run start:dev         # API on http://localhost:4000/api
```

API docs (dev only): **http://localhost:4000/api/docs**

## Demo credentials (from seed)

| Role         | Email                    | Password   | Can do                                        |
| ------------ | ------------------------ | ---------- | --------------------------------------------- |
| Super-admin  | superadmin@gmail.com     | password   | Everything + **branding** + **manage admins** |
| Admin        | admin@gmail.com          | password   | Content moderation, approvals, payouts        |
| Instructor   | instructor@gmail.com     | 12345678   | Create/sell courses, request payouts          |
| Student      | user@gmail.com           | 12345678   | Buy, learn, review                            |

Log in for all of them at `/login`; tick **"administrator"** for the two admin tiers.

### Admin tiers

- **Super-admin** is the top tier. Only super-admins can rebrand the platform (`Admin → Branding`) and manage admin accounts (`Admin → Admins`: create / promote / demote / remove, with a guard against deleting the last super-admin). Enforced server-side via a `@SuperAdmin()` guard — regular admins get **403**.
- **Admin** handles day-to-day moderation (course/instructor approvals, reviews, withdrawals, CMS, blog) but cannot touch branding or admin accounts.

## Implemented endpoints

**Auth** — `POST /auth/register` · `/auth/login` · `/auth/admin/login` · `/auth/refresh` · `GET /auth/me`
**Courses** — `GET /courses` (search/filter/paginate) · `GET /courses/:slug` · `GET /courses/mine` · `POST /courses` · `PUT /courses/:id`
**Course content** (instructor) — `GET|POST|PUT|DELETE /courses/:id/content/chapters` · `.../lessons`
**Categories** — `GET /categories` (+ admin CRUD)
**Cart** — `GET /cart` · `POST /cart/:courseId` · `DELETE /cart/:id`
**Checkout / orders** — `POST /checkout` (free-fulfill or Stripe) · `POST /checkout/webhook` · `GET /orders` · `GET /orders/:id`
**Learning** — `GET /learn` (enrolled + progress) · `GET /learn/:slug` (player) · `GET /learn/lesson/:id` · `POST /learn/lesson/:id/watch` · `.../complete`
**Reviews** — `POST /reviews` (enrolled-only, moderated)
**Taxonomy** — `GET /levels` · `GET /languages` (+ admin create)
**Dashboards** — `GET /dashboard/student` · `/dashboard/instructor` · `/dashboard/admin`
**Admin** — `GET /admin/courses|instructors|reviews|students` · `POST .../:id/approve|reject`
**Payouts** — `GET|POST /payouts/withdraws` · `GET|PUT /payouts/info` · `GET /admin/withdraws` · `POST /admin/withdraws/:id/approve|reject`
**Certificates** — `GET /certificates/:courseId/download` (PDF, gated on 100% completion)
**CMS** — `GET /cms/home` · `/cms/settings` (+ admin hero/features/testimonials/counters CRUD)
**Blog** — `GET /blog` · `/blog/:slug` · `POST /blog/:id/comments` (+ admin post/category/comment mgmt)
**System** — `GET /health` · `GET /branding` (white-label descriptor)

## Frontend (Next.js)

Runs on `http://localhost:3000`. Themes itself from `/api/branding` via CSS variables — change brand colors with zero rebuild.

Pages: home (hero + categories + featured), course catalog (search/filter/paginate), course detail (curriculum + reviews + add-to-cart), login/register (with admin toggle & role picker), cart + Stripe checkout, checkout success, student dashboard (progress tracking), instructor dashboard, and the **course player** (video/YouTube/Vimeo embed, curriculum sidebar, mark-complete, live progress).

```bash
cd apps/web
npm run dev   # http://localhost:3000  (point NEXT_PUBLIC_API_URL at the API)
```

## White-label model

This is the **rebrandable-product** model: each buyer deploys their own copy and rebrands it — no multi-tenancy required.

**Runtime rebranding (no redeploy):** the super-admin edits branding live from **Admin → Branding** (`/dashboard/admin/branding`) — company name, logo, favicon, primary/secondary colors, currency, commission. Values are stored in the `settings` table and override the `.env` defaults. The whole app re-themes from a single `GET /api/branding` response:
- Colors → CSS variables applied at runtime (light & dark).
- Logo → shown in the header/footer (falls back to a letter mark).
- Favicon → set in the document `<head>`.
- Currency → used in all price/earnings formatting.

`PUT /api/admin/branding` (admin-only, 403 for everyone else) saves overrides; `PUT /api/admin/branding/reset` restores env defaults. `.env` remains the per-install baseline for headless/first-boot setup.

## Roadmap

- [x] Monorepo, tooling, config
- [x] Full Prisma schema (45 tables)
- [x] Core: Prisma module, global guards, validation, error filter, Swagger, Helmet, rate limiting
- [x] Multi-role auth (admin / instructor / student)
- [x] Courses catalog + instructor course CRUD, categories
- [x] Instructor course-content management (chapters/lessons CRUD)
- [x] Cart, checkout, Stripe payments, orders, enrollment, instructor wallet credit
- [x] Course player: chapters/lessons, watch history, completion, progress
- [x] Reviews (enrolled-only, moderated) + student/instructor/admin dashboards
- [x] Next.js frontend (home, catalog, course page, auth, cart/checkout, player, dashboards)
- [x] Instructor course-builder UI (create/edit + chapters/lessons) + admin console (approvals/moderation)
- [x] Instructor payouts / withdraws (API + UI, admin approval)
- [x] Certificate PDF generation (pdfkit) + download, gated on 100% completion
- [x] CMS content-block API + blog (API + public list/detail)
- [x] Admin UI for CMS editing & blog authoring (`/dashboard/admin/content`)
- [x] File/image upload (local disk driver + static serving) wired into course thumbnails
- [x] SMTP mail (instructor approval/rejection), degrades to logging without a mail server
- [x] Live end-to-end DB run verified (full create→approve→enroll→complete→certificate lifecycle)
- [ ] S3 upload driver (local driver done; S3 branch stubbed)
- [ ] Production hardening: versioned Prisma migrations, CI, automated test suite

## Notes / caveats

- A few CMS content-block columns (hero, feature, footer, testimonial, blog) were inferred from model names rather than the original migrations — **reconcile against the Laravel migrations before relying on them.**
- The schema targets **PostgreSQL**. `prisma db push` is used for schema sync; generate versioned migrations (`prisma migrate dev`) before production.
- `certificates` uses **pdfkit** (pure-JS, no headless Chromium) for reliability; the original's positional certificate-builder can be layered on later.
