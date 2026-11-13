# EduCore Software Overview

EduCore is a white-label learning management system (LMS) and online course
marketplace. It provides public course discovery, learner and instructor
workspaces, administrative tools, course checkout, and platform-level
multi-tenant management.

## Technology

- **Web application:** Next.js App Router, React, and TypeScript (`apps/web`)
- **API:** NestJS and TypeScript (`apps/api`)
- **Persistence:** PostgreSQL through Prisma
- **Authentication:** Argon2 password hashing and signed JWT access/refresh tokens
- **Integrations:** Stripe, PayPal, Razorpay, Google/GitHub OAuth, SAML 2.0, SMTP,
  optional OpenAI-powered course outlines, and optional S3-compatible storage

## User roles

| Role | Main capabilities |
|---|---|
| Student | Browse and buy courses, study enrolled content, track progress, earn certificates, and write course reviews |
| Instructor | Create and submit courses for review, manage curriculum and lessons, view sales, manage payout information, and request withdrawals |
| Tenant admin | Moderate courses, instructors, reviews, withdrawals, users, content, promotions, and workspace settings |
| Platform super-admin | Manage tenants, plans, platform-level settings, branding, admin accounts, payment configuration, and operational oversight |

Authorization is enforced by API guards and tenant-scoped data access, not only
by hiding interface elements.

## Student functionality

- Public storefront with homepage content, course search, catalog filters,
  categories, levels, languages, and course detail pages.
- Course pages show curriculum, instructor details, tags, pricing, and reviews.
- Cart supports course discounts, coupon codes, and automatically applied active
  offers. Prices are recalculated by the server during checkout.
- Checkout supports Stripe, PayPal, and Razorpay when configured. Free orders
  can be fulfilled without a payment gateway. A mock gateway is available only
  when explicitly enabled in development or test environments.
- Student dashboard and **My Learning** show enrollments, progress, activity,
  and options to resume a course.
- Course player supports hosted media, YouTube, Vimeo, articles and other lesson
  content types, curriculum navigation, lesson completion, and saved progress.
- Eligible learners can download a PDF certificate after completing a course.
- Reviews are associated with enrolled learners and can be moderated.
- Account features include profile management, email/password changes, password
  recovery, email verification, and optional TOTP two-factor authentication.

## Instructor functionality

- Select the instructor role during signup; new instructors require approval
  before publishing courses.
- Create and edit courses, organize chapters and lessons, reorder curriculum,
  upload media/resources, set pricing and discounts, and configure previews,
  capacity, certificates, and Q&A.
- Preview a course before submitting it for admin review.
- Generate a draft course outline from a topic using OpenAI when configured, or
  the built-in generator when it is not.
- View instructor dashboard and course sales data.
- Track wallet earnings after completed purchases, save payout details, and
  submit withdrawal requests for admin review.

## Tenant administration

- Dashboard views for sales, enrollments, activity, and course performance.
- Approve or reject instructor applications and submitted courses.
- Moderate reviews and manage student/instructor accounts.
- Review instructor withdrawal requests.
- Manage catalog categories, course levels, languages, and tags.
- Create and manage coupons and time-limited offers; review redemption analytics.
- Edit storefront content, homepage sections, custom pages, blog posts,
  categories and comments, contact details, announcements, and uploaded files.
- Configure workspace branding and selected settings through the admin
  interface.
- Configure workspace SAML single sign-on where enabled.

## Platform super-admin functionality

- Create, inspect, activate, suspend, and manage tenant workspaces.
- Define subscription plans and manage tenant billing through Stripe.
- Manage platform admins, their roles, and tenant assignments.
- Manage platform branding, platform settings, payment credentials, and
  operational/audit views.
- Use the superadmin setup wizard to create a tenant and owner, configure its
  optional SAML sign-in, and save/test the platform-wide Razorpay integration.
- Register and verify custom domains for tenant workspaces.
- Manage platform-level coupons, resellers, leads, and revenue views.

## Authentication and account lifecycle

- Email/password registration for students and instructors; admin accounts are
  created by an administrator.
- Optional Google and GitHub sign-in when provider credentials are configured.
- Optional tenant SAML sign-in.
- Optional TOTP-based 2FA for accounts.
- Email verification and password-reset links are sent through the configured
  SMTP mail queue.
- Login issues short-lived access tokens and refresh tokens. Remember-me selects
  persistent browser storage; otherwise tokens are held for the browser session.
- Refresh requests validate the current account and its token version. Password,
  role, or tenant changes revoke existing refresh tokens.
- Tenant status, role permissions, request validation, rate limiting, and
  security headers are enforced by the API.

## Payments and promotions

### Course purchases

- **Stripe:** Checkout Sessions with a signed webhook used to confirm successful
  payments.
- **PayPal:** Orders API checkout with server-side capture and validation against
  the local order, reference, amount, and currency.
- **Razorpay:** Server-created orders; payment signature and provider payment
  status, order, amount, and currency are validated before fulfillment.
- Payment availability is exposed by the API so the storefront can hide
  unconfigured gateways.
- Successful fulfillment enrolls the buyer, credits instructor wallets after
  commission, removes purchased cart items, and records applicable promotion
  redemption.
- Order fulfillment atomically claims a pending order to prevent duplicate
  wallet credits from concurrent payment confirmations.

### Coupons and offers

- Percentage or fixed discounts, with optional caps, minimum order amounts,
  usage limits, per-buyer limits, active dates, and course/category scopes.
- Offers apply automatically during their active window and can be promoted on
  the storefront.
- One promotion applies to an order; the server determines the applicable
  discount and amount.

### Platform subscriptions

- Subscription plans and recurring tenant billing are handled separately from
  course purchases, using a distinct Stripe billing flow and webhook secret.

## Content and learning tools

- CMS-managed homepage and storefront settings, editable custom pages with
  content blocks and SEO fields, and a public blog with comments.
- Announcements, contact forms/settings, file management, and site taxonomy.
- Lesson progress, watch history, resumable learning, completion status, and
  certificate generation.
- Audit logs and administrative reporting for supported platform operations.

## Branding, tenancy, and configuration

- Runtime branding includes platform/workspace name, logo, favicon, colors,
  currency, and commission settings.
- Tenant-owned data is scoped by tenant context. Tenant status can restrict
  access, and custom domains can resolve to tenant workspaces.
- SMTP settings can be supplied through environment variables or the admin
  settings UI. Database settings override environment defaults where supported.
- Stripe and PayPal course checkout credentials are configured through the
  environment. Razorpay settings can also be managed from the admin UI.
- Production requires explicit `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
  Mock checkout is disabled in production, even if its opt-in variable is set.
- Uploaded files can use local storage or configured S3-compatible storage.

## API and developer operations

- REST API endpoints are grouped by authentication, courses, content, learning,
  cart/orders, promotions, dashboards, administration, billing, and platform
  services.
- Swagger/OpenAPI documentation is available at `/api/docs` outside production.
- Health endpoint is available at `/api/health`.
- Prisma schema and hand-written SQL migrations are maintained under
  `apps/api/prisma`.

## Setup and production notes

- Start with `.env.example`; provide database and required production secrets.
- Configure SMTP to deliver verification and password-reset emails.
- Configure gateway/provider credentials before offering those integrations to
  users.
- Apply `apps/api/prisma/migrations/auth_token_version_and_provider_order.sql`
  before deploying the auth revocation and payment-order binding changes.
- Protect real `.env` files and never commit provider credentials.
- Some optional integrations require external account setup and credentials.
  Their presence in the application does not mean they are configured for every
  deployment.
