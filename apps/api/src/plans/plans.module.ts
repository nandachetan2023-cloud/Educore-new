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
import { StripeBillingService } from '../billing/stripe-billing.service';

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
 * billing/upgrade UI — see BillingModule). Syncs Stripe Product/Price on
 * create/update when Stripe is configured; plans keep working for manual
 * tenant assignment with null stripeProductId/stripePriceId when it's not.
 */
@Injectable()
export class PlansService {
  constructor(
    @Inject(RAW_PRISMA) private raw: PrismaClient,
    private stripeBilling: StripeBillingService,
  ) {}

  list() {
    return this.raw.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  }

  async get(id: number) {
    const plan = await this.raw.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto) {
    const currency = dto.currency ?? 'usd';
    let stripeProductId: string | undefined;
    let stripePriceId: string | undefined;
    if (this.stripeBilling.enabled) {
      const product = await this.stripeBilling.createProduct(dto.name);
      const price = await this.stripeBilling.createPrice(product.id, dto.priceMonthly, currency);
      stripeProductId = product.id;
      stripePriceId = price.id;
    }
    return this.raw.plan.create({
      data: {
        name: dto.name,
        slug: slug(dto.slug ?? dto.name),
        priceMonthly: dto.priceMonthly,
        currency,
        stripeProductId,
        stripePriceId,
      },
    });
  }

  async update(id: number, dto: UpdatePlanDto) {
    const plan = await this.get(id);
    const priceChanged =
      (dto.priceMonthly !== undefined && dto.priceMonthly !== plan.priceMonthly) ||
      (dto.currency !== undefined && dto.currency !== plan.currency);

    let stripePriceId = plan.stripePriceId;
    if (priceChanged && this.stripeBilling.enabled) {
      // Stripe prices are immutable, so a price/currency change mints a new
      // Price under the same Product and retires the old one.
      const productId = plan.stripeProductId ?? (await this.stripeBilling.createProduct(dto.name ?? plan.name)).id;
      const price = await this.stripeBilling.createPrice(
        productId,
        dto.priceMonthly ?? plan.priceMonthly,
        dto.currency ?? plan.currency,
      );
      if (plan.stripePriceId) await this.stripeBilling.deactivatePrice(plan.stripePriceId);
      stripePriceId = price.id;
      return this.raw.plan.update({
        where: { id },
        data: { ...dto, stripeProductId: productId, stripePriceId },
      });
    }

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
  providers: [PlansService, StripeBillingService],
  controllers: [PlansController],
})
export class PlansModule {}
