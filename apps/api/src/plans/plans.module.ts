import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';

const slug = (t: string) => slugify(t, { lower: true, strict: true });

class CreatePlanDto {
  @IsString() name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsInt() @Min(0) priceMonthly!: number; // minor units (cents)
  @IsOptional() @IsString() currency?: string;
}

class UpdatePlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(0) priceMonthly?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * Plan CRUD. Superadmin manages plans; any tenant Admin can list them (for a
 * billing/upgrade UI — see BillingModule, Phase 3). Stripe Product/Price
 * sync is NOT wired yet (Phase 3) — plans are stored locally with null
 * stripeProductId/stripePriceId until then.
 */
@Injectable()
export class PlansService {
  constructor(@Inject(RAW_PRISMA) private raw: PrismaClient) {}

  list() {
    return this.raw.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  }

  async get(id: number) {
    const plan = await this.raw.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  create(dto: CreatePlanDto) {
    return this.raw.plan.create({
      data: {
        name: dto.name,
        slug: slug(dto.slug ?? dto.name),
        priceMonthly: dto.priceMonthly,
        currency: dto.currency ?? 'usd',
      },
    });
  }

  async update(id: number, dto: UpdatePlanDto) {
    await this.get(id);
    return this.raw.plan.update({ where: { id }, data: dto });
  }
}

@ApiTags('plans')
@Controller('admin/plans')
@Roles(Principal.ADMIN)
export class PlansController {
  constructor(private plans: PlansService) {}

  @Get()
  list() {
    return this.plans.list();
  }

  @Post()
  @SuperAdmin()
  create(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Put(':id')
  @SuperAdmin()
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }
}

@Module({
  providers: [PlansService],
  controllers: [PlansController],
})
export class PlansModule {}
