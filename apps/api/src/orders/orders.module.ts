import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Gateway, OrdersService } from './orders.service';
import { StripeService } from '../payments/stripe.service';
import { PayPalService } from '../payments/paypal.service';
import { RazorpayService } from '../payments/razorpay.service';
import { Public, Roles, CurrentUser } from '../common/decorators';
import { Principal } from '../common/enums';

class CheckoutDto {
  @IsOptional() @IsIn(['stripe', 'paypal', 'razorpay']) gateway?: Gateway;
}
class PaypalCaptureDto {
  @IsString() paypalOrderId!: string;
}
class RazorpayVerifyDto {
  @IsString() razorpayOrderId!: string;
  @IsString() razorpayPaymentId!: string;
  @IsString() signature!: string;
}

@ApiTags('checkout')
@Controller()
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private stripe: StripeService,
  ) {}

  @Public()
  @Get('checkout/gateways')
  gateways() {
    return this.orders.availableGateways();
  }

  @Roles(Principal.STUDENT, Principal.INSTRUCTOR)
  @Post('checkout')
  checkout(
    @CurrentUser('sub') userId: number,
    @CurrentUser('email') email: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.orders.checkout(userId, email, dto.gateway ?? 'stripe');
  }

  @Roles(Principal.STUDENT, Principal.INSTRUCTOR)
  @Post('checkout/paypal/:orderId/capture')
  capturePaypal(
    @CurrentUser('sub') userId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: PaypalCaptureDto,
  ) {
    return this.orders.capturePaypal(userId, orderId, dto.paypalOrderId);
  }

  @Roles(Principal.STUDENT, Principal.INSTRUCTOR)
  @Post('checkout/razorpay/:orderId/verify')
  verifyRazorpay(
    @CurrentUser('sub') userId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: RazorpayVerifyDto,
  ) {
    return this.orders.verifyRazorpay(userId, orderId, dto);
  }

  @Roles(Principal.STUDENT, Principal.INSTRUCTOR)
  @Get('orders')
  list(@CurrentUser('sub') userId: number) {
    return this.orders.listForUser(userId);
  }

  @Roles(Principal.STUDENT, Principal.INSTRUCTOR)
  @Get('orders/:id')
  detail(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orders.getForUser(userId, id);
  }

  /** Stripe calls this to confirm payment. Verified by signature, not auth. */
  @Public()
  @Post('checkout/webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('Missing body');
    const event = this.stripe.constructWebhookEvent(req.rawBody, signature);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        metadata?: { orderId?: string };
        payment_intent?: string;
      };
      const orderId = Number(session.metadata?.orderId);
      if (orderId) {
        await this.orders.fulfill(orderId, session.payment_intent ?? `stripe-${event.id}`);
      }
    }
    return { received: true };
  }
}

@Module({
  providers: [OrdersService, StripeService, PayPalService, RazorpayService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
