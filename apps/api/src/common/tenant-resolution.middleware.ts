import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import NodeCache from 'node-cache';
import { RAW_PRISMA } from '../prisma/prisma.module';

declare module 'express' {
  interface Request {
    /** Set by this middleware when the request's host resolves to a tenant's custom domain. */
    tenantHost?: { id: number };
  }
}

/**
 * Resolves `req.tenantHost` from the request's domain, for `@Public()`
 * routes hit before any JWT exists (course catalog browsing, `GET
 * /branding`) — read by `ClsModule`'s interceptor setup in `app.module.ts`,
 * which prioritizes it below an authenticated principal's own `tenantId`
 * but above the dev-only `X-Tenant-Id` header.
 *
 * Only `verified` domains are trusted here — a tenant merely *setting*
 * `customDomain` (via `DomainsModule`) must not let it start receiving
 * another tenant's traffic before DNS ownership is proven.
 *
 * Runs as Express middleware (registered in `AppModule.configure()`),
 * before Nest guards, so `req.tenantHost` is available by the time the CLS
 * interceptor and `TenantActiveGuard` run.
 */
@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  // Domain->tenant lookups happen on every public request (catalog pages,
  // branding); a short cache avoids a DB round-trip per request for what's
  // otherwise static data. Mirrors TenantStatusCache's 30s tradeoff.
  private cache = new NodeCache({ stdTTL: 30 });

  constructor(@Inject(RAW_PRISMA) private raw: PrismaClient) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const host = (req.headers['x-tenant-domain'] as string | undefined) || req.hostname;
    if (host) {
      const key = host.toLowerCase();
      let tenant = this.cache.get<{ id: number } | null>(key);
      if (tenant === undefined) {
        const row = await this.raw.tenant.findFirst({
          where: { customDomain: key, domainStatus: 'verified' },
          select: { id: true },
        });
        tenant = row ?? null;
        this.cache.set(key, tenant);
      }
      if (tenant) req.tenantHost = tenant;
    }
    next();
  }
}
