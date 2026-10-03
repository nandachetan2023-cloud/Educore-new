import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import * as argon2 from 'argon2';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, SuperAdmin, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

class CreateAdminDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsIn(['admin', 'super_admin']) role?: 'admin' | 'super_admin';
  /** Optional white-label workspace to attach this admin to. Omit/null = platform-level (no tenant branding). */
  @IsOptional() @IsInt() tenantId?: number | null;
}

class SetAdminTenantDto {
  /** Tenant to attach the admin to, or null to detach to platform-level. */
  @IsOptional() @IsInt() tenantId?: number | null;
}

/**
 * Admin-account management. Restricted to super-admins — the top tier that can
 * create/remove other admins and promote/demote them.
 */
@Injectable()
export class AdminsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.admin.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        tenantId: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateAdminDto) {
    const existing = await this.prisma.admin.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An admin with this email already exists');
    let tenantId: number | null | undefined = dto.tenantId ?? null;
    if (tenantId != null) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException('Tenant not found');
      if ((dto.role ?? 'admin') === 'super_admin') {
        throw new BadRequestException('A tenant admin cannot be a platform superadmin');
      }
    } else {
      tenantId = null;
    }
    const admin = await this.prisma.admin.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: await argon2.hash(dto.password),
        role: dto.role ?? 'admin',
        tenantId,
      },
      select: { id: true, name: true, email: true, role: true, tenantId: true },
    });
    return admin;
  }

  async setRole(actorId: number, id: number, role: 'admin' | 'super_admin') {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    // Guard against removing the last super-admin.
    if (admin.role === 'super_admin' && role === 'admin') {
      const superCount = await this.prisma.admin.count({ where: { role: 'super_admin' } });
      if (superCount <= 1) throw new BadRequestException('Cannot demote the last super-admin');
    }
    // A tenant-owning admin can't become a tenant-less platform superadmin
    // without first being detached from the tenant they own — otherwise the
    // tenant is left without a login. Detaching ownership isn't handled by
    // this endpoint (it's a Tenants-console concern), so just refuse.
    if (role === 'super_admin' && admin.tenantId != null) {
      throw new BadRequestException(
        'This admin owns a tenant and cannot be made a platform superadmin. Detach them from their tenant first.',
      );
    }
    return this.prisma.admin.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async remove(actorId: number, id: number) {
    if (actorId === id) throw new BadRequestException('You cannot delete your own account');
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.role === 'super_admin') {
      const superCount = await this.prisma.admin.count({ where: { role: 'super_admin' } });
      if (superCount <= 1) throw new BadRequestException('Cannot delete the last super-admin');
    }
    await this.prisma.admin.delete({ where: { id } });
    return { removed: true };
  }

  /**
   * Attach/detach an admin user to a white-label workspace (tenant).
   * Attaching gives them that tenant's branding/domain; detaching (null)
   * makes them platform-level. Tenant owners cannot be detached without
   * transferring ownership first, and tenant members cannot be promoted
   * via this endpoint (use POST :id/role).
   */
  async setTenant(id: number, tenantId: number | null) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    if (tenantId != null) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException('Tenant not found');
      if (admin.role === 'super_admin') {
        throw new BadRequestException('Detach from super-admin first: a tenant admin cannot be a platform superadmin');
      }
    } else if (admin.tenantId != null) {
      const owned = await this.prisma.tenant.findUnique({ where: { ownerAdminId: admin.id } });
      if (owned) {
        throw new BadRequestException(
          'This admin owns a tenant and cannot be detached. Transfer ownership or delete the tenant first.',
        );
      }
    }
    return this.prisma.admin.update({
      where: { id },
      data: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
  }
}

@ApiTags('admins')
@Controller('admin/admins')
@Roles(Principal.ADMIN)
@SuperAdmin()
export class AdminsController {
  constructor(private admins: AdminsService) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Post()
  create(@Body() dto: CreateAdminDto) {
    return this.admins.create(dto);
  }

  @Post(':id/role')
  setRole(
    @CurrentUser('sub') actorId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: 'admin' | 'super_admin',
  ) {
    if (role !== 'admin' && role !== 'super_admin') {
      throw new ForbiddenException('Invalid role');
    }
    return this.admins.setRole(actorId, id, role);
  }

  @Put(':id/tenant')
  setTenant(@Param('id', ParseIntPipe) id: number, @Body() dto: SetAdminTenantDto) {
    return this.admins.setTenant(id, dto.tenantId ?? null);
  }

  @Delete(':id')
  remove(@CurrentUser('sub') actorId: number, @Param('id', ParseIntPipe) id: number) {
    return this.admins.remove(actorId, id);
  }
}

@Module({
  providers: [AdminsService],
  controllers: [AdminsController],
})
export class AdminsModule {}
