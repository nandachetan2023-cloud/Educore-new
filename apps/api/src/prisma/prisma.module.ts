import { Global, Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaConnection, PrismaService } from './prisma.service';
import { tenantScopingExtension } from './tenant-scoping.extension';
import { TENANT_CLS_KEY } from '../common/tenant-context';

/**
 * Unscoped Prisma client — for code that legitimately crosses tenant
 * boundaries: the Superadmin console (Tenants/Plans), billing webhooks,
 * domain resolution middleware, and the seed script. Using a distinct token
 * makes "this code intentionally sees all tenants" grep-able.
 */
export const RAW_PRISMA = Symbol('RAW_PRISMA');

@Global()
@Module({
  providers: [
    PrismaConnection,
    { provide: RAW_PRISMA, useExisting: PrismaConnection },
    {
      provide: PrismaService,
      useFactory: (raw: PrismaConnection, cls: ClsService) =>
        raw.$extends(tenantScopingExtension(() => cls.get(TENANT_CLS_KEY))) as unknown as PrismaService,
      inject: [PrismaConnection, ClsService],
    },
  ],
  exports: [PrismaService, RAW_PRISMA],
})
export class PrismaModule {}
