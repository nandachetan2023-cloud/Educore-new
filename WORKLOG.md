# EduCore Worklog

## 2026-11-12

### Auth hardening and review
- Email verification, TOTP 2FA, forgot/reset password, SAML SSO scaffolding.
- Full API suite: 6 suites / 61 tests passing; API + web typecheck clean; lint 0 errors.
- E2E smoke test passed end-to-end.
- Fixed demo seed passwords (`instructor`/`user` = `12345678`, admins = `password`) and updated live DB rows.

### Student My Learning
- `GET /learn` now returns modules, lessons, progress, next lesson, last activity.
- Added `/dashboard/my-learning` page with filters/search and resume.
- Player resumes first incomplete lesson and supports `?lesson=` deep links.

### Course builder tags
- Tenant-scoped `Tag` / `CourseTag` schema + migration.
- API: `GET/POST /tags`, `DELETE /tags/:id`, course `tagIds` create/update, catalog tag filter, tags in course payloads.
- Web: builder + edit page tag selection/creation, public course + preview tag display, catalog tag filter.

### Remember me
- Login sends `rememberMe`; unchecked = 1-day session token in sessionStorage, checked = 30-day token in localStorage.
- Refresh rotation preserves the choice.

### Superadmin page builder (complete)
- `CustomPage` gains `blocks` (JSONB), `seoTitle`, `seoDescription`; migration `page_builder.sql`.
- API: superadmin-only CRUD, duplicate, unique slug handling, block validation, published/unpublished.
- Web: block palette (11 block types), drag/reorder/hide/duplicate, live preview, SEO settings, published page list.
- Public `/page/[slug]` renders blocks with metadata/SEO; legacy HTML fallback retained.
- Verified: create/publish/duplicate/delete + public render; build and typecheck pass.

## 2026-11-13

### README status and setup refresh
- Updated the project overview to reflect the current full-stack LMS features and production roadmap.
- Clarified local setup, PostgreSQL initialization, demo seed configuration, and admin-tier permissions.
- Expanded documentation for coupon and offer behavior, including pricing and redemption rules.

### Authentication and payments review
- Auth currently includes JWT access/refresh tokens, role-based login, remember-me sessions, email verification, password reset/change, email change, TOTP 2FA, OAuth, SAML, tenant status checks, and audit logging.
- Course checkout supports Stripe, PayPal, Razorpay, and non-production mock payments; checkout prices are recalculated server-side with coupons/offers. Payment confirmation fulfills orders, enrolls buyers, credits instructor wallets, and records promotion redemptions.
- Fixed refresh authorization to reload current account roles/tenant and revoke refresh tokens after password, role, or tenant changes.
- Bound PayPal and Razorpay confirmations to the stored provider order, local order amount/currency, and completed/captured provider payment details.
- Made order fulfillment claim the pending order atomically before enrollment or wallet credits, preventing duplicate credits from concurrent confirmations.
- Production startup now requires explicit JWT secrets. Mock checkout requires `ENABLE_MOCK_PAYMENTS=true` and an explicitly set development/test environment; it remains disabled in production.
- Updated `.env.example` with the local mock-payment opt-in and blank JWT secret values plus production setup guidance.
- Added SQL migration `apps/api/prisma/migrations/auth_token_version_and_provider_order.sql`; apply it before deploying these changes.
- Full API test suite passed: 8 suites, 75 tests; API typecheck passed. Lint passed with 10 existing warnings and no errors.

### Database schema mismatch
- Investigated the website's generic "Database error": API and PostgreSQL were reachable, but the live database lacked `admins.token_version`, `users.token_version`, and `orders.provider_order_id`.
- Applied the existing idempotent SQL migration to the configured database and verified all three columns.
- Added `db:push` scripts and corrected setup guidance to use schema synchronization, configure seed passwords from `.env`, and avoid treating the flat SQL migration directory as Prisma migration history.
- Updated `educore-setup.bat` to stop with a clear message if demo seed passwords are missing and removed the obsolete hard-coded demo-password display.

### Superadmin tenant setup wizard
- Merged "Sell a new tenant" into the wizard so workspace name, plan, owner account, and password are created before auth/payment setup.
- Added a tenants-page entry point to create and configure a new tenant in one guided flow.
- Added superadmin-only tenant SAML configuration endpoints and linked the wizard in the platform navigation.
- Added SAML service tests for wizard tenant load/save and missing-tenant handling.
- Verified API/web typechecks, the web production build, all 9 SAML service tests, and `git diff --check`.

### Dashboard sidebar design
- Improved shared left navigation contrast on its dark background; updated active/hover states, focus rings, workspace/user cards, and environment badge.
- Updated the mobile navigation tabs with clearer active and hover states.
- Verified the web production build passed after the shared sidebar update.

### Existing tenant setup
- Updated the setup wizard to offer both new-tenant creation and configuration of an existing tenant.
- Existing tenant selection reuses that tenant's saved SAML configuration and does not create another workspace.
- Updated `educore-setup.bat` completion output with direct links to the tenant setup wizard and white-label logo/favicon settings.

### Team member invitations
- Fixed the admin invite flow: it now prepares an email with the sign-in link and generated temporary password, then inserts the account and mail queue job atomically.
- The invite form reports that the email is queued instead of exposing the temporary password; invite creation now clearly fails before account creation when SMTP is not configured.
- Added API regression tests for queued invitations and SMTP-missing behavior.
