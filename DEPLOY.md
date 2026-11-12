# EduCore Go-Live & White-Label Deploy Checklist

## Infra prerequisites
- PostgreSQL 14+ with `DATABASE_URL`
- Node 20+
- Nginx reverse proxy with Let's Encrypt
- SMTP credentials

## Nginx example for multi-tenant custom domains

```nginx
# catch-all server block for platform + custom domains
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name _;

    ssl_certificate /etc/letsencrypt/live/platform.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/platform.example.com/privkey.pem;

    # Proxy API
    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Proxy Web app
    location / {
        proxy_pass http://127.0.0.1:3004/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
Note: For true per-domain SSL, use wildcard cert or certbot DNS-01 per tenant. After tenant verifies custom domain via TXT, add ServerName to this block or use a wildcard.

## Environment
```env
NODE_ENV=production
API_PORT=4000
WEB_PORT=3004
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
MAIL_HOST=...
BRAND_NAME=EduCore
NEXT_PUBLIC_API_URL=https://platform.example.com/api
```

## Database
```bash
npx prisma generate
# This repo stores hand-written, flat SQL migrations (no Prisma migration
# history), so apply each file explicitly:
npx prisma db execute --file prisma/migrations/password_reset_and_coupon_approval.sql
npx prisma db execute --file prisma/migrations/two_factor_auth.sql
npx prisma db execute --file prisma/migrations/email_verification.sql
npx prisma db execute --file prisma/migrations/sso_config.sql
npx prisma db seed   # only for first admin
```
> `prisma migrate deploy` fails with P3005 on an existing database unless it is
> baselined first. For a brand-new dev database, `prisma migrate dev` or
> `prisma db push` also works.

## Run
```bash
npm run start:api
npm run start:web
```

## Student portal on a `learn.` subdomain

The student-facing site can live on `learn.example.com` while the platform
marketing site stays on the apex domain. Nothing in the app hard-codes the
host — only env vars and DNS/reverse-proxy entries are needed.

1. **DNS** — add an `A` (or `AAAA`) record `learn` → server IP, or a `CNAME`
   `learn` → the web host. Wait for propagation before requesting a cert.
2. **TLS** — issue a certificate for the subdomain:
   ```bash
   certbot --nginx -d learn.example.com
   ```
3. **Nginx** — either add `learn.example.com` to the existing `server_name`
   list, or duplicate the block and keep the same two locations:
   ```nginx
   server_name learn.example.com;

   location /api/ { proxy_pass http://127.0.0.1:4000/; proxy_set_header Host $host; ... }
   location /     { proxy_pass http://127.0.0.1:3004/; proxy_set_header Host $host; ... }
   ```
   Because `/api` is proxied on the same origin, the browser keeps using
   same-origin `/api` and CORS is not involved.
4. **Environment** (root `.env` / `apps\api\.env`):
   ```env
   # Links in verification + password-reset emails and OAuth redirect target
   WEB_URL=https://learn.example.com
   # Callback base for the OAuth apps (only if callback through the same host)
   OAUTH_CALLBACK_BASE=https://learn.example.com
   # Leave NEXT_PUBLIC_API_URL unset for same-origin /api
   ```
   Register `https://learn.example.com/api/auth/oauth/google/callback` (and the
   GitHub equivalent) in each provider console. If the API is on its own host,
   set `OAUTH_CALLBACK_BASE=https://api.example.com` instead and register the
   callbacks against that host.
5. **Restart the API** after changing env — `WEB_URL` is read at startup and is
   what makes verification/reset emails point at the subdomain.
6. **Verify** — sign up on the subdomain, click the emailed link, use
   "Forgot password?", and confirm social login returns to
   `https://learn.example.com/auth/callback`.

> `learn.` is just the platform's public entry point. Per-tenant custom domains
> are a separate mechanism (Superadmin → Tenants → custom domain + TXT
> verification) and can coexist with the subdomain.

## Single sign-on (SAML 2.0)

Tenant admins configure SSO under **Admin console → Single sign-on**. The IdP
is described by its **metadata URL**; the API fetches it on save, derives the
SSO entry point + signing certificate, and caches them for 10 minutes.

1. In your IdP, create a SAML app and use the two URLs shown on that page:
   - **SP metadata URL** — `{API_BASE}/api/auth/saml/metadata?tenant=<slug>`
     (upload/point the IdP at this XML)
   - **ACS / Reply URL** — `{API_BASE}/api/auth/saml/callback`
2. Paste the IdP metadata URL in the admin page and enable SSO.
3. Link learners to `{API_BASE}/api/auth/saml/login?tenant=<slug>` (or let the
   frontend call `GET /api/auth/saml/providers?tenant=<slug>` first and show a
   button when `enabled`). Successful logins land on
   `{WEB_URL}/auth/callback` with the usual JWT query params.
4. First-time identities are provisioned as **students** in that tenant and
   their email is treated as verified, because the IdP asserted it. Existing
   accounts with the same email are reused.

Requirements: the IdP must assert an email address
(`NameID` with the email format, or an `email`/`mail` attribute) and sign the
assertion. The SP entity ID is the metadata URL; override it in the advanced
section if your IdP requires a fixed value.

> Apply `apps/api/prisma/migrations/sso_config.sql` before using this feature
> (the repo keeps flat SQL migrations, so run it with
> `prisma db execute --file prisma/migrations/sso_config.sql`).

## Go-live steps
1. Set env vars, change JWT secrets.
2. Deploy code, run migrations.
3. Configure Nginx + SSL.
4. Create Superadmin via seed or admin UI.
5. Test tenant flow: Superadmin -> Tenants -> create tenant -> set custom domain -> verify TXT -> access via custom domain.
6. Test tenant suspension blocks public catalog.
7. Enable mail queue, verify SMTP.
8. Enable Stripe/PayPal webhooks with production URLs.

## Security
- Disable `x-tenant-domain` header in production – already gated.
- `TenantActiveGuard` now enforces status for host-resolved tenants.
- Prisma scoping now injects tenantId into findUnique and rejects tenantId <=0.
