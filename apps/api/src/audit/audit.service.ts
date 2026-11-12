import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Prisma } from '@prisma/client';
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
  /** Force the workspace this event belongs to; normally derived from the principal. */
  tenantId?: number;
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
      // Workspace stamping: tenant admins and user principals belong to their
      // workspace; the platform superadmin and unauthenticated system jobs
      // stay platform-level (NULL), because they see/act across workspaces.
      const tenantId =
        entry.tenantId ??
        (principal && principal.adminRole !== 'super_admin' ? principal.tenantId ?? null : null);
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
          tenantId,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch {
      // Auditing must never break the primary operation.
    }
  }

  list(opts: { action?: string; actorType?: string; tenantId?: number; take?: number; skip?: number }) {
    const where = {
      ...(opts.action ? { action: { startsWith: opts.action } } : {}),
      ...(opts.actorType ? { actorType: opts.actorType as never } : {}),
      ...(opts.tenantId !== undefined ? { tenantId: opts.tenantId } : {}),
    };
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.take ?? 50, 200),
      skip: opts.skip ?? 0,
    });
  }

  /**
   * Activity feed for a workspace admin: their own staff's actions plus
   * platform events concerning their workspace — and never another
   * workspace's activity. The tenantId comes from the JWT principal, not a
   * query parameter, so it cannot be forged.
   */
  listForPrincipal(principal: AuthPrincipal, opts: { action?: string; take?: number; skip?: number }) {
    // Super admins have no workspace: their "own" feed is the full platform trail.
    const tenantId = principal.adminRole === 'super_admin' ? undefined : principal.tenantId ?? -1;
    return this.list({ ...opts, tenantId });
  }

  /**
   * Paginated, filtered activity feed for a workspace admin. The tenant comes
   * from the JWT principal (never a query parameter), so one workspace can
   * never read another workspace's trail.
   */
  async listPageForPrincipal(
    principal: AuthPrincipal,
    opts: { page?: number; limit?: number; action?: string; entity?: string; q?: string },
  ) {
    const tenantId = principal.adminRole === 'super_admin' ? undefined : principal.tenantId ?? -1;
    const where: Prisma.AuditLogWhereInput = {
      ...(tenantId !== undefined ? { tenantId } : {}),
      // "create" should match "coupon.create" — the console filters by verb.
      ...(opts.action ? { action: { contains: opts.action, mode: 'insensitive' } } : {}),
      ...(opts.entity ? { entity: { equals: opts.entity, mode: 'insensitive' } } : {}),
      ...(opts.q
        ? {
            OR: [
              { actorName: { contains: opts.q, mode: 'insensitive' } },
              { action: { contains: opts.q, mode: 'insensitive' } },
              { entity: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 25));

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        actorName: r.actorName,
        // Actor identity is stored in one column; admins log in with an email.
        actorEmail: r.actorName?.includes('@') ? r.actorName : null,
        actorRole: r.actorRole,
        entity: r.entity,
        entityId: r.entityId,
        meta: (r.meta ?? null) as Record<string, unknown> | null,
        ipAddress: r.ip,
        tenantId: r.tenantId,
        createdAt: r.createdAt,
      })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
