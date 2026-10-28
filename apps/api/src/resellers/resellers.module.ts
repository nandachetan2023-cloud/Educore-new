import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, ParseIntPipe, Post, Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { SuperAdmin } from '../common/decorators';
import { AuditService } from '../audit/audit.service';

class ResellerDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionRate?: number;
}

class PayoutDto {
  @IsNumber() @Min(1) amount!: number;
  @IsOptional() @IsString() note?: string;
}

@Injectable()
export class ResellersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list() {
    return this.prisma.reseller.findMany({
      include: { payouts: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: ResellerDto) {
    const reseller = await this.prisma.reseller.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        companyName: dto.companyName,
        commissionRate: dto.commissionRate ?? 20,
      },
    });
    await this.audit.log({ action: 'reseller.create', entity: 'reseller', entityId: reseller.id });
    return reseller;
  }

  async update(id: number, dto: Partial<ResellerDto> & { status?: 'active' | 'suspended' }) {
    const existing = await this.prisma.reseller.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Reseller not found');
    const reseller = await this.prisma.reseller.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.commissionRate != null ? { commissionRate: dto.commissionRate } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
    await this.audit.log({
      action: dto.status ? `reseller.${dto.status === 'suspended' ? 'suspend' : 'activate'}` : 'reseller.update',
      entity: 'reseller',
      entityId: id,
      meta: dto as Record<string, unknown>,
    });
    return reseller;
  }

  async remove(id: number) {
    const existing = await this.prisma.reseller.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Reseller not found');
    await this.prisma.reseller.delete({ where: { id } });
    await this.audit.log({ action: 'reseller.delete', entity: 'reseller', entityId: id });
    return { removed: true };
  }

  /** Record a commission payout for a reseller. */
  async addPayout(id: number, dto: PayoutDto) {
    const reseller = await this.prisma.reseller.findUnique({ where: { id } });
    if (!reseller) throw new NotFoundException('Reseller not found');
    const [payout] = await this.prisma.$transaction([
      this.prisma.resellerPayout.create({
        data: { resellerId: id, amount: dto.amount, note: dto.note },
      }),
      this.prisma.reseller.update({
        where: { id },
        data: { totalEarned: { increment: dto.amount } },
      }),
    ]);
    await this.audit.log({ action: 'reseller.payout', entity: 'reseller', entityId: id, meta: { amount: dto.amount } });
    return payout;
  }

  /** Mark a pending payout as paid (Super Admin settled it). */
  async settlePayout(payoutId: number) {
    const payout = await this.prisma.resellerPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found');
    return this.prisma.resellerPayout.update({ where: { id: payoutId }, data: { status: 'paid' } });
  }

  payouts(id: number) {
    return this.prisma.resellerPayout.findMany({ where: { resellerId: id }, orderBy: { createdAt: 'desc' } });
  }
}

@ApiTags('resellers')
@Controller('admin/resellers')
@SuperAdmin()
export class ResellersController {
  constructor(private resellers: ResellersService) {}

  @Get() list() { return this.resellers.list(); }

  @Post() create(@Body() dto: ResellerDto) { return this.resellers.create(dto); }

  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: ResellerDto & { status?: 'active' | 'suspended' }) {
    return this.resellers.update(id, dto);
  }

  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.resellers.remove(id); }

  @Post(':id/payouts') addPayout(@Param('id', ParseIntPipe) id: number, @Body() dto: PayoutDto) {
    return this.resellers.addPayout(id, dto);
  }

  @Get(':id/payouts') payouts(@Param('id', ParseIntPipe) id: number) { return this.resellers.payouts(id); }

  @Put('payouts/:payoutId/settle') settle(@Param('payoutId', ParseIntPipe) payoutId: number) {
    return this.resellers.settlePayout(payoutId);
  }
}

@Module({
  providers: [ResellersService],
  controllers: [ResellersController],
})
export class ResellersModule {}
