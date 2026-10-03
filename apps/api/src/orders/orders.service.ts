import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.module';
import { StripeService } from '../payments/stripe.service';
import { PayPalService } from '../payments/paypal.service';
import { RazorpayService } from '../payments/razorpay.service';
import { netPrice } from '../cart/cart.module';

export type Gateway = 'stripe' | 'paypal' | 'razorpay';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private paypal: PayPalService,
    private razorpay: RazorpayService,
    private coupons: CouponsService,
    private config: ConfigService,
  ) {}

  /** Which gateways are actually usable on this install (have credentials configured). */
  async availableGateways() {
    const razorpay = await this.razorpay.getConfig();
    return {
      stripe: this.stripe.enabled,
      paypal: this.paypal.enabled,
      razorpay: razorpay.enabled,
      razorpayKeyId: razorpay.enabled ? razorpay.keyId : undefined,
    };
  }

  /**
   * Turns the user's cart into a pending order, then either fulfills it
   * immediately (all-free cart) or hands back the chosen gateway's checkout
   * URL/handle. `gateway` defaults to Stripe for backward compatibility.
   * `couponCode` is optional and re-validated here — the client never gets to
   * decide what a cart costs.
   */
  async checkout(
    userId: number,
    email: string,
    gateway: Gateway = 'stripe',
    couponCode?: string,
  ) {
    const cartItems = await this.prisma.cart.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, price: true, discount: true } } },
    });
    if (cartItems.length === 0) throw new BadRequestException('Your cart is empty');

    // Throws with a readable reason when a code is unknown, expired, used up or
    // simply doesn't cover anything in the cart.
    const promo = await this.coupons.priceCartForUser(userId, couponCode);

    const currency = this.config.get<string>('brand.currency')!;
    const commissionRate = this.config.get<number>('brand.commissionRate')!;
    const total = promo.total;
    const discounted = promo.discountTotal > 0;
    const pricedByCourse = new Map(promo.priced.lines.map((l) => [l.courseId, l]));

    // Create the order + items up front so fulfillment is a pure state change.
    const order = await this.prisma.order.create({
      data: {
        invoiceId: `INV-${nanoid(10).toUpperCase()}`,
        buyerId: userId,
        status: 'pending',
        totalAmount: total,
        paidAmount: 0,
        currency,
        hasCoupon: Boolean(promo.couponCode),
        couponCode: promo.couponCode,
        couponAmount: promo.couponCode ? promo.discountTotal : null,
        offerId: promo.offerId,
        offerTitle: promo.offerTitle,
        offerAmount: promo.offerId ? promo.discountTotal : null,
        transactionId: '',
        paymentMethod: total === 0 ? 'free' : gateway,
        items: {
          create: cartItems.map((i) => ({
            courseId: i.course.id,
            price: pricedByCourse.get(i.course.id)?.final ?? netPrice(i.course),
            commissionRate,
          })),
        },
      },
      include: { items: true },
    });

    if (total === 0) {
      await this.fulfill(order.id, `FREE-${nanoid(8)}`);
      return {
        free: true,
        orderId: order.id,
        invoiceId: order.invoiceId,
        subtotal: promo.subtotal,
        discount: promo.discountTotal,
        total,
        coupon: promo.coupon,
        offer: promo.offer,
      };
    }

    const web = this.config.get<string>('webUrl');
    const receipt = {
      subtotal: promo.subtotal,
      discount: promo.discountTotal,
      total,
      coupon: promo.coupon,
      offer: promo.offer,
    };

    if (gateway === 'paypal') {
      const paypalOrder = await this.paypal.createOrder({
        orderId: order.id,
        currency,
        amount: total,
        returnUrl: `${web}/checkout/paypal/return?order=${order.id}`,
        cancelUrl: `${web}/cart?canceled=1`,
      });
      return { free: false, orderId: order.id, checkoutUrl: paypalOrder.approveUrl, ...receipt };
    }

    if (gateway === 'razorpay') {
      const rpOrder = await this.razorpay.createOrder({
        orderId: order.id,
        currency,
        amountMinor: Math.round(total * 100),
      });
      return {
        free: false,
        orderId: order.id,
        ...receipt,
        razorpay: {
          keyId: rpOrder.keyId,
          razorpayOrderId: rpOrder.id,
          amount: rpOrder.amount,
          currency: rpOrder.currency,
        },
      };
    }

    const session = await this.stripe.createCheckoutSession({
      orderId: order.id,
      currency,
      customerEmail: email,
      lineItems: cartItems.map((i) => ({
        name: i.course.title,
        amountMinor: Math.round((pricedByCourse.get(i.course.id)?.final ?? netPrice(i.course)) * 100),
        quantity: 1,
      })),
      successUrl: `${web}/checkout/success?order=${order.id}`,
      cancelUrl: `${web}/cart?canceled=1`,
    });

    return { free: false, orderId: order.id, checkoutUrl: session.url, ...receipt };
  }

  /** Called after the buyer approves payment on PayPal's site. */
  async capturePaypal(userId: number, orderId: number, paypalOrderId: string) {
    const order = await this.getForUser(userId, orderId);
    if (order.status === 'approved') return { ok: true }; // already fulfilled
    const captureId = await this.paypal.captureOrder(paypalOrderId);
    await this.fulfill(orderId, captureId);
    return { ok: true };
  }

  /** Called by the frontend after the Razorpay checkout widget succeeds. */
  async verifyRazorpay(
    userId: number,
    orderId: number,
    payload: { razorpayOrderId: string; razorpayPaymentId: string; signature: string },
  ) {
    const order = await this.getForUser(userId, orderId);
    if (order.status === 'approved') return { ok: true };
    if (!(await this.razorpay.verifySignature(payload))) {
      throw new BadRequestException('Payment verification failed');
    }
    await this.fulfill(orderId, payload.razorpayPaymentId);
    return { ok: true };
  }

  /**
   * Idempotently finalizes an order: marks it paid, enrolls the buyer in every
   * course, credits each instructor's wallet (minus platform commission), and
   * clears the purchased items from the buyer's cart.
   */
  async fulfill(orderId: number, transactionId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'approved') return; // already fulfilled — no-op

    const courseIds = order.items.map((i) => i.courseId);
    const courses = await this.prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, instructorId: true },
    });
    const instructorOf = new Map(courses.map((c) => [c.id, c.instructorId]));

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'approved', paidAmount: order.totalAmount, transactionId },
      });

      for (const item of order.items) {
        const instructorId = instructorOf.get(item.courseId);
        if (!instructorId) continue;

        // Enroll (skip if somehow already enrolled).
        const exists = await tx.enrollment.findFirst({
          where: { userId: order.buyerId, courseId: item.courseId },
        });
        if (!exists) {
          await tx.enrollment.create({
            data: {
              userId: order.buyerId,
              courseId: item.courseId,
              instructorId,
              haveAccess: true,
            },
          });
        }

        // Credit instructor wallet with their share.
        const share = item.price * (1 - (item.commissionRate ?? 0) / 100);
        if (share > 0) {
          await tx.user.update({
            where: { id: instructorId },
            data: { wallet: { increment: share } },
          });
        }
      }

      // Empty the purchased items from the cart.
      await tx.cart.deleteMany({
        where: { userId: order.buyerId, courseId: { in: courseIds } },
      });
    });

    // Coupon/offer usage is only counted once money actually changed hands.
    const discount = Math.max(order.couponAmount ?? 0, order.offerAmount ?? 0);
    if (discount > 0) {
      await this.coupons.recordRedemption({
        id: order.id,
        buyerId: order.buyerId,
        totalAmount: order.totalAmount,
        couponCode: order.couponCode,
        offerId: order.offerId,
        discount,
        courseCount: courseIds.length,
      });
    }

    this.logger.log(
      `Order ${orderId} fulfilled (${courseIds.length} courses${discount > 0 ? `, ${discount.toFixed(2)} discounted` : ''})`,
    );
  }

  async listForUser(userId: number) {
    return this.prisma.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { /* course title resolved on frontend if needed */ } },
      },
    });
  }

  async getForUser(userId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId: userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
