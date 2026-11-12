import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthPrincipal, CurrentUser, Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('admin/audit-logs')
@SuperAdmin()
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(
    @Query('action') action?: string,
    @Query('actorType') actorType?: string,
    @Query('tenantId') tenantId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const tenantIdNum = Number(tenantId);
    return this.audit.list({
      action: action || undefined,
      actorType: actorType || undefined,
      tenantId: Number.isFinite(tenantIdNum) && tenantId ? tenantIdNum : undefined,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }
}

/** Every workspace admin's own activity feed — scoped to their tenant on the server. */
@ApiTags('audit')
@Controller('admin/audit-logs')
@Roles(Principal.ADMIN)
export class MyAuditController {
  constructor(private audit: AuditService) {}

  @Get('mine')
  mine(
    @CurrentUser() principal: AuthPrincipal,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.listPageForPrincipal(principal, {
      action: action || undefined,
      entity: entity || undefined,
      q: q || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}

/** Global so auth/tenants/coupons can inject AuditService without imports. */
@Global()
@Module({
  providers: [AuditService],
  controllers: [AuditController, MyAuditController],
  exports: [AuditService],
})
export class AuditModule {}
