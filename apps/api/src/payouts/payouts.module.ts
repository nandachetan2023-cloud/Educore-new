import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { IsNumber, IsString, Min } from 'class-validator';
import { nanoid } from 'nanoid';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

class PayoutInfoDto {
  @IsString() gateway!: string;
  @IsString() information!: string; // JSON blob of gateway fields
}
class WithdrawDto {
  @IsNumber() @Min(1) amount!: number;
}

@Injectable()
export class PayoutsService {
  constructor(private prisma: PrismaService) {}

  gateways() {
    return this.prisma.payoutGateway.findMany({ where: { status: true } });
  }

  getInfo(instructorId: number) {
    return this.prisma.instructorPayoutInformation.findMany({ where: { instructorId } });
  }

  async saveInfo(instructorId: number, dto: PayoutInfoDto) {
    const existing = await this.prisma.instructorPayoutInformation.findFirst({
      where: { instructorId, gateway: dto.gateway },
    });
    if (existing) {
      return this.prisma.instructorPayoutInformation.update({
        where: { id: existing.id },
        data: { information: dto.information },
      });
    }
    return this.prisma.instructorPayoutInformation.create({
      data: { instructorId, gateway: dto.gateway, information: dto.information },
    });
  }

  myWithdraws(instructorId: number) {
    return this.prisma.withdraw.findMany({
      where: { instructorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async requestWithdraw(instructorId: number, dto: WithdrawDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: instructorId },
      select: { wallet: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Reserve against pending requests too, so balance can't be double-spent.
    const pending = await this.prisma.withdraw.aggregate({
      where: { instructorId, status: 'pending' },
      _sum: { amount: true },
    });
    const available = user.wallet - (pending._sum.amount ?? 0);
    if (dto.amount > available) {
      throw new BadRequestException(`Insufficient balance. Available: ${available.toFixed(2)}`);
    }
    return this.prisma.withdraw.create({
      data: { instructorId, amount: dto.amount, status: 'pending' },
    });
  }

  // ── Admin ──
  allWithdraws(status?: string) {
    return this.prisma.withdraw.findMany({
      where: status ? { status: status as any } : {},
      include: { instructor: { select: { name: true, email: true, wallet: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async decideWithdraw(id: number, decision: 'approved' | 'rejected') {
    const withdraw = await this.prisma.withdraw.findUnique({ where: { id } });
    if (!withdraw) throw new NotFoundException('Withdraw not found');
    if (withdraw.status !== 'pending') {
      throw new BadRequestException('This request has already been processed');
    }

    if (decision === 'rejected') {
      return this.prisma.withdraw.update({ where: { id }, data: { status: 'rejected' } });
    }

    // Approve: debit the wallet atomically.
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: withdraw.instructorId },
        select: { wallet: true },
      });
      if (!user || user.wallet < withdraw.amount) {
        throw new BadRequestException('Instructor no longer has sufficient balance');
      }
      await tx.user.update({
        where: { id: withdraw.instructorId },
        data: { wallet: { decrement: withdraw.amount } },
      });
      return tx.withdraw.update({
        where: { id },
        data: { status: 'approved', transactionId: `PO-${nanoid(10).toUpperCase()}` },
      });
    });
  }
}

@ApiTags('payouts')
@Controller()
export class PayoutsController {
  constructor(private payouts: PayoutsService) {}

  @Roles(Principal.INSTRUCTOR)
  @Get('payouts/gateways')
  gateways() {
    return this.payouts.gateways();
  }

  @Roles(Principal.INSTRUCTOR)
  @Get('payouts/info')
  getInfo(@CurrentUser('sub') id: number) {
    return this.payouts.getInfo(id);
  }

  @Roles(Principal.INSTRUCTOR)
  @Put('payouts/info')
  saveInfo(@CurrentUser('sub') id: number, @Body() dto: PayoutInfoDto) {
    return this.payouts.saveInfo(id, dto);
  }

  @Roles(Principal.INSTRUCTOR)
  @Get('payouts/withdraws')
  myWithdraws(@CurrentUser('sub') id: number) {
    return this.payouts.myWithdraws(id);
  }

  @Roles(Principal.INSTRUCTOR)
  @Post('payouts/withdraws')
  request(@CurrentUser('sub') id: number, @Body() dto: WithdrawDto) {
    return this.payouts.requestWithdraw(id, dto);
  }

  @Roles(Principal.ADMIN)
  @Get('admin/withdraws')
  all(@Param('status') status?: string) {
    return this.payouts.allWithdraws(status);
  }

  @Roles(Principal.ADMIN)
  @Post('admin/withdraws/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.payouts.decideWithdraw(id, 'approved');
  }

  @Roles(Principal.ADMIN)
  @Post('admin/withdraws/:id/reject')
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.payouts.decideWithdraw(id, 'rejected');
  }
}

@Module({
  providers: [PayoutsService],
  controllers: [PayoutsController],
})
export class PayoutsModule {}
