import { HttpException, HttpStatus } from '@nestjs/common';

/** Thrown when a tenant's subscription/status means it should be locked out. */
export class TenantSuspendedException extends HttpException {
  constructor(message = "This workspace's subscription is not active.") {
    super({ error: 'tenant_suspended', message }, HttpStatus.PAYMENT_REQUIRED);
  }
}
