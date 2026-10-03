# EduCore — Product Features

A white-label learning management system and online course marketplace. Deploy it under your own brand and domain — every buyer runs their own copy, and your customers never see our name.

---

## For Learners

### Discover courses
- **Course catalogue** with search, filtering and pagination across categories, levels and languages
- **Detailed course pages** showing the full curriculum, instructor profile, and learner reviews
- **Category and taxonomy browsing** organised by level and language
- **Live offers strip** on the home page surfacing any flash sale currently running

### Learn
- **Built-in course player** supporting hosted video, YouTube and Vimeo
- **Curriculum sidebar** for jumping between chapters and lessons
- **Automatic progress tracking** — your position is saved, so you always resume where you left off
- **Watch history** of everything you have started
- **Mark-as-complete** on lessons and lessons, with completion percentage per course
- **Certificates** — a personalised PDF certificate, automatically unlocked at 100% completion and downloadable at any time

### Account and community
- **Simple registration** by email, or one-click sign-in with Google or GitHub
- **Progress dashboard** giving a clear view of every enrolled course and how far through each one you are
- **Verified reviews** — only learners who are actually enrolled in a course can review it
- **Cart and coupons** — apply a discount code at checkout and see the saving before you pay

---

## For Instructors

### Build and sell
- **Course builder** to create and edit courses, then structure content into chapters and lessons
- **Flexible pricing** set per course, with optional course-level discounts
- **Media uploads** for thumbnails and lesson assets
- **Sales reporting** showing enrolment and revenue per course

### Get paid
- **Instructor wallet** that accrues earnings automatically on every enrolment
- **Commission handled automatically** — platform commission is deducted per purchase, and sale discounts are absorbed by the platform rather than by instructors
- **Withdrawal requests** with visible status, reviewed and approved by an administrator
- **Payout information** saved securely against your account

---

## For Administrators

### Moderate and approve
- **Instructor approval workflow** — review applications before anyone can publish
- **Course approval workflow** — review submitted courses before they appear in the catalogue
- **Review moderation** — approve or reject learner reviews
- **Withdrawal approval** — review and approve instructor payout requests

### Run promotions
- **Coupon codes** — percentage or fixed-amount discounts with an optional maximum discount cap, minimum order value, total-use limit, per-buyer limit, start and end dates, and a scope of *all courses*, *selected courses*, or *selected categories*
- **Flash-sale offers** — time-boxed campaigns that discount their scoped courses automatically, with no code for shoppers to type. Badges, banners and copy appear in the "On sale right now" strip automatically
- **Sensible discount rules** — one promotion applies per order, so shoppers never accidentally stack discounts, and pricing is always recalculated server-side so a tampered cart total is ignored
- **Redemption reporting** — usage counts and total revenue given back, viewable per promotion

### Manage content
- **Page builder** for the homepage and custom static pages (About, Terms, and similar)
- **Blog** — write posts, organise categories, and moderate comments
- **Contact page** editor for title, details and layout
- **Announcement banner** — a promotional message strip across the site, editable without a code change
- **File manager** to review and remove uploaded files

### Manage people and the business
- **User management** for student and instructor accounts
- **Two admin tiers** — a Superadmin who handles branding, admin accounts and payment credentials, and tenant admins who handle day-to-day moderation
- **Sales and activity dashboards** covering revenue, orders, enrolments and top courses

---

## Platform Capabilities

### Payments — three gateways, live out of the box
- **Stripe** — card payments via Checkout, with signed webhook confirmation
- **PayPal** — Payments flow including capture on return
- **Razorpay** — cards, netbanking, UPI and wallets, with mandatory signature verification before an order is fulfilled
- **Automatic availability** — the storefront only offers payment options that are actually configured and working, so shoppers never hit a dead end at the final step
- **Free enrolments** supported — a fully discounted order completes without touching a payment gateway
- **Gateway credentials managed in the admin panel** for Razorpay, changeable without a redeploy

### White-labelling
- **Full runtime rebranding** — company name, logo, favicon, primary and secondary colours, currency and commission rate, all editable from the admin panel
- **Instant re-theming** — the entire site restyles from a single configuration response, with no rebuild and no redeploy
- **Per-workspace branding** — each workspace under the multi-tenant model can carry its own identity and custom domain

### Multi-workspace and billing
- **Sell the platform as a subscription** — plan definitions, recurring revenue tracking and per-workspace subscriptions
- **Custom domains** — register, verify and route a domain to a specific workspace
- **Workspace lifecycle** — activate, suspend and reactivate tenant accounts

### Security and reliability
- **Three-tier role-based access control** enforced server-side on every endpoint, not just hidden in the interface
- **Strong password hashing** (Argon2) and short-lived rotating access tokens with refresh tokens
- **Rate limiting, security headers and strict request validation** throughout
- **Multi-tenant data isolation** — tenant scoping applied automatically at the data layer
- **REST API with full documentation** for every operation, ready for custom integrations

### Technical
- **Modern, maintainable stack** — TypeScript throughout, NestJS API and Next.js frontend
- **Documented API** (OpenAPI/Swagger) for every endpoint
- **Automated email** for approvals, rejections and account notifications
- **Seeded demo content** so you can evaluate the whole product immediately after install

---

## Summary

| Area | Highlights |
|---|---|
| Learning | Course player, progress tracking, watch history, PDF certificates |
| Commerce | Cart, coupons, flash sales, three payment gateways, free enrolments |
| Teaching | Course builder, analytics, wallet, withdrawal requests |
| Administration | Approvals, moderation, promos, CMS, blog, user and admin management |
| Platform | White-labelling, multi-workspace subscriptions, custom domains |
| Security | Role-based access, Argon2 hashing, rotating tokens, rate limiting, tenant isolation |