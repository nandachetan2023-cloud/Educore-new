import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SuperAdmin } from '../common/decorators';
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
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.audit.list({
      action: action || undefined,
      actorType: actorType || undefined,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }
}

/** Global so auth/tenants/coupons can inject AuditService without imports. */
@Global()
@Module({
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
