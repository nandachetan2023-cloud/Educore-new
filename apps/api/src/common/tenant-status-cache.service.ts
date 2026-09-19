import { Injectable } from '@nestjs/common';
import NodeCache from 'node-cache';

/**
 * Short-lived cache of tenant status, so `TenantActiveGuard` doesn't hit the
 * database on every single authenticated request. A ~30s staleness window is
 * an explicit, deliberate tradeoff (latency/DB-load vs. how fast suspension
 * takes effect) — `invalidate()` lets tenant-mutating code (suspend/
 * reactivate, billing webhooks) get immediate effect instead of waiting out
 * the TTL.
 */
@Injectable()
export class TenantStatusCache {
  private cache = new NodeCache({ stdTTL: 30 });

  async getStatus(tenantId: number, loader: () => Promise<string>): Promise<string> {
    const key = String(tenantId);
    const cached = this.cache.get<string>(key);
    if (cached !== undefined) return cached;
    const status = await loader();
    this.cache.set(key, status);
    return status;
  }

  invalidate(tenantId: number) {
    this.cache.del(String(tenantId));
  }
}
