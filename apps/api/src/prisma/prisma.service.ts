import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The single real database connection. Nest manages its lifecycle directly.
 * Exported so `PrismaModule` can hand it out, unwrapped, as `RAW_PRISMA` for
 * code that must legitimately cross tenant boundaries (Superadmin console,
 * billing webhooks, domain resolution, seed script).
 */
@Injectable()
export class PrismaConnection extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

/**
 * Type/injection-token for the TENANT-SCOPED client. Every existing
 * `constructor(private prisma: PrismaService)` across the app resolves to a
 * `PrismaConnection` wrapped in the tenant-scoping extension (see
 * `prisma.module.ts`), so all ~18 pre-existing services get automatic tenant
 * isolation with zero call-site changes. This class is never instantiated
 * directly — Nest resolves it via a `useFactory` provider instead.
 */
export class PrismaService extends PrismaClient {}
