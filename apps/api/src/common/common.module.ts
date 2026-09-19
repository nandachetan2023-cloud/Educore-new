import { Global, Module } from '@nestjs/common';
import { TenantStatusCache } from './tenant-status-cache.service';

/** Shared, cross-cutting providers (not tenant-scoped business logic). */
@Global()
@Module({
  providers: [TenantStatusCache],
  exports: [TenantStatusCache],
})
export class CommonModule {}
