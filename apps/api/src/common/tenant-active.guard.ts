import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { IS_PUBLIC_KEY, AuthPrincipal } from './decorators';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { TenantStatusCache } from './tenant-status-cache.service';
import { TenantSuspendedException } from './tenant-suspended.exception';

/**
 * Enforces tenant status on every authenticated request, not just at login —
 * closes the gap a login-only check would leave for the lifetime of an
 * already-issued access token. Superadmin (no tenantId) always passes.
 */
@Injectable()
export class TenantActiveGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(RAW_PRISMA) private raw: PrismaClient,
    private tenantStatusCache: TenantStatusCache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthPrincipal | undefined;
    const hostTenantId = (req as any).tenantHost?.id as number | undefined;

    // Determine tenantId to enforce: authenticated principal wins, else host-resolved tenant.
    const tenantId = user?.tenantId ?? hostTenantId;

    if (!tenantId) return true;

    // Superadmin bypass
    if (user?.adminRole === 'super_admin') return true;

    const status = await this.tenantStatusCache.getStatus(tenantId, async () => {
      const tenant = await this.raw.tenant.findUnique({
        where: { id: tenantId },
        select: { status: true },
      });
      return tenant?.status ?? 'suspended';
    });

    if (status === 'suspended') {
      throw new TenantSuspendedException();
    }
    return true;
  }
}
