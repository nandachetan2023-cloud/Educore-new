import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Logger,
  Module,
  Param,
  ParseIntPipe,
  Post,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsModule, CouponsService } from '../coupons/coupons.module';
import { round2 } from '../coupons/discount';
import { Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

/** Effective price of a course after discount, clamped to >= 0. */
export function netPrice(course: { price: number | null; discount: number | null }) {
  return Math.max(0, (course.price ?? 0) - (course.discount ?? 0));
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private prisma: PrismaService,
    private coupons: CouponsService,
  ) {}

  /**
   * Cart contents plus whatever running offer already discounts them. The
   * subtotal stays the pre-offer net price (the storefront shows it struck
   * through) and `total` is what the buyer actually pays once the offer lands.
   */
  async list(userId: number) {
    const items = await this.prisma.cart.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            price: true,
            discount: true,
            instructor: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const subtotal = round2(items.reduce((sum, i) => sum + netPrice(i.course), 0));

    let promo = null;
    try {
      promo = await this.coupons.priceCartForUser(userId);
    } catch (e) {
      this.logger.warn(`Offer pricing skipped for cart: ${(e as Error).message}`);
    }

    const byCourse = new Map(promo?.priced.lines.map((l) => [l.courseId, l]) ?? []);
    const priced = items.map((i) => {
      const line = byCourse.get(i.course.id);
      return {
        ...i,
        course: {
          ...i.course,
          offerDiscount: line?.discount ?? 0,
          payable: line ? line.final : round2(netPrice(i.course)),
        },
      };
    });

    return {
      items: priced,
      subtotal,
      total: promo?.total ?? subtotal,
      offer: promo?.offer ?? null,
      count: items.length,
    };
  }

  async add(userId: number, courseId: number) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: 'active', isApproved: 'approved' },
      select: { id: true, instructorId: true },
    });
    if (!course) throw new NotFoundException('Course not available');
    if (course.instructorId === userId) {
      throw new BadRequestException('You cannot buy your own course');
    }

    const already = await this.prisma.enrollment.findFirst({
      where: { userId, courseId },
    });
    if (already) throw new BadRequestException('You are already enrolled');

    const existing = await this.prisma.cart.findFirst({
      where: { userId, courseId },
    });
    if (existing) return existing; // idempotent add

    return this.prisma.cart.create({ data: { userId, courseId } });
  }

  async remove(userId: number, id: number) {
    const item = await this.prisma.cart.findUnique({ where: { id } });
    if (!item || item.userId !== userId) {
      throw new NotFoundException('Cart item not found');
    }
    await this.prisma.cart.delete({ where: { id } });
    return { removed: true };
  }
}

@ApiTags('cart')
@Controller('cart')
@Roles(Principal.STUDENT, Principal.INSTRUCTOR)
export class CartController {
  constructor(private cart: CartService) {}

  @Get()
  list(@CurrentUser('sub') userId: number) {
    return this.cart.list(userId);
  }

  @Post(':courseId')
  add(
    @CurrentUser('sub') userId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.cart.add(userId, courseId);
  }

  @Delete(':id')
  remove(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cart.remove(userId, id);
  }
}

@Module({
  imports: [CouponsModule],
  providers: [CartService],
  controllers: [CartController],
  exports: [CartService],
})
export class CartModule {}
