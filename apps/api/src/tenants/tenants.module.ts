import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';
import { TenantStatusCache } from '../common/tenant-status-cache.service';

const slug = (t: string) => slugify(t, { lower: true, strict: true });

class CreateTenantDto {
  @IsString() tenantName!: string;
  @IsString() adminName!: string;
  @IsEmail() adminEmail!: string;
  @IsString() @MinLength(8) adminPassword!: string;
  @IsInt() planId!: number;
  @IsOptional() @IsString() slug?: string;
}

const TENANT_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
  subscription: { include: { plan: true } },
} as const;

/**
 * Superadmin-only: creates/lists/suspends tenants. Uses RAW_PRISMA
 * deliberately throughout — every method here reads or writes across
 * tenants by design, so it must bypass the tenant-scoping extension.
 */
@Injectable()
export class TenantsService {
  constructor(
    @Inject(RAW_PRISMA) private raw: PrismaClient,
    private tenantStatusCache: TenantStatusCache,
  ) {}

  list() {
    return this.raw.tenant.findMany({ include: TENANT_INCLUDE, orderBy: { createdAt: 'desc' } });
  }

  async get(id: number) {
    const tenant = await this.raw.tenant.findUnique({ where: { id }, include: TENANT_INCLUDE });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const plan = await this.raw.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new BadRequestException('Unknown plan');

    const existingAdmin = await this.raw.admin.findUnique({ where: { email: dto.adminEmail } });
    if (existingAdmin) throw new ConflictException('An admin with this email already exists');

    const tenantSlug = slug(dto.slug ?? dto.tenantName);
    const existingSlug = await this.raw.tenant.findUnique({ where: { slug: tenantSlug } });
    if (existingSlug) throw new ConflictException('A tenant with this slug already exists');

    const passwordHash = await argon2.hash(dto.adminPassword);

    // Everything below must read/write through the SAME transaction client
    // (`tx`), not `this.raw` — the transaction hasn't committed yet, so a
    // query on a different connection wouldn't see these rows.
    return this.raw.$transaction(async (tx) => {
      const admin = await tx.admin.create({
        data: { name: dto.adminName, email: dto.adminEmail, password: passwordHash, role: 'admin' },
      });
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug: tenantSlug, ownerAdminId: admin.id, status: 'active' },
      });
      await tx.admin.update({ where: { id: admin.id }, data: { tenantId: tenant.id } });
      await tx.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: 'active' } });
      return tx.tenant.findUnique({ where: { id: tenant.id }, include: TENANT_INCLUDE });
    });
  }

  async suspend(id: number) {
    await this.get(id); // 404s if missing
    const tenant = await this.raw.tenant.update({
      where: { id },
      data: { status: 'suspended', manuallySuspended: true },
      include: TENANT_INCLUDE,
    });
    this.tenantStatusCache.invalidate(id);
    return tenant;
  }

  async reactivate(id: number) {
    await this.get(id);
    const tenant = await this.raw.tenant.update({
      where: { id },
      data: { status: 'active', manuallySuspended: false },
      include: TENANT_INCLUDE,
    });
    this.tenantStatusCache.invalidate(id);
    return tenant;
  }
}

@ApiTags('tenants')
@Controller('admin/tenants')
@Roles(Principal.ADMIN)
@SuperAdmin()
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Get()
  list() {
    return this.tenants.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.tenants.get(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Post(':id/suspend')
  suspend(@Param('id', ParseIntPipe) id: number) {
    return this.tenants.suspend(id);
  }

  @Post(':id/reactivate')
  reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.tenants.reactivate(id);
  }
}

@Module({
  providers: [TenantsService],
  controllers: [TenantsController],
})
export class TenantsModule {}
