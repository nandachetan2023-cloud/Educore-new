import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { AuthPrincipal } from '../common/decorators';
import { PRINCIPAL_CLS_KEY } from '../common/tenant-context';

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: number;
  meta?: Record<string, unknown>;
  /** Overrides — normally resolved from the request's CLS principal. */
  actorType?: 'admin' | 'user' | 'system';
  actorId?: number;
  actorName?: string;
  actorRole?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Platform-wide audit trail. Writes are fire-and-forget (never break the
 * request they're recording); reads are Super-admin only.
 */
@Injectable()
export class AuditService {
  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      const principal = (this.cls.get(PRINCIPAL_CLS_KEY) ?? null) as AuthPrincipal | null;
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entity: entry.entity ?? null,
          entityId: entry.entityId ?? null,
          meta: (entry.meta ?? undefined) as never,
          actorType: entry.actorType ?? (principal ? 'admin' : 'system'),
          actorId: entry.actorId ?? principal?.sub ?? null,
          actorName: entry.actorName ?? principal?.email ?? null,
          actorRole:
            entry.actorRole ?? (principal ? `${principal.principal}${principal.adminRole ? `:${principal.adminRole}` : ''}` : 'system'),
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch {
      // Auditing must never break the primary operation.
    }
  }

  list(opts: { action?: string; actorType?: string; take?: number; skip?: number }) {
    const where = {
      ...(opts.action ? { action: { startsWith: opts.action } } : {}),
      ...(opts.actorType ? { actorType: opts.actorType as never } : {}),
    };
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.take ?? 50, 200),
      skip: opts.skip ?? 0,
    });
  }
}
