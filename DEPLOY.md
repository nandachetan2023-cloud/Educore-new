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
npx prisma migrate deploy
npx prisma db seed   # only for first admin
```

## Run
```bash
npm run start:api
npm run start:web
```

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
