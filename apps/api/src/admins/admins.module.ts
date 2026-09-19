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
} from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
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
      select: { id: true, name: true, email: true, role: true, image: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateAdminDto) {
    const existing = await this.prisma.admin.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An admin with this email already exists');
    const admin = await this.prisma.admin.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: await argon2.hash(dto.password),
        role: dto.role ?? 'admin',
      },
      select: { id: true, name: true, email: true, role: true },
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
