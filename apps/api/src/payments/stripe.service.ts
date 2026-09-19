import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Thin wrapper around the Stripe SDK. Lazily instantiated so the app still
 * boots (and free courses still work) when no Stripe key is configured.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private config: ConfigService) {
    const key = this.config.get<string>('stripe.secretKey');
    if (key) {
      this.client = new Stripe(key, { apiVersion: '2023-10-16' });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — card checkout disabled.');
    }
  }

  get enabled() {
    return this.client !== null;
  }

  private require(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException('Card payments are not configured');
    }
    return this.client;
  }

  createCheckoutSession(params: {
    orderId: number;
    currency: string;
    lineItems: { name: string; amountMinor: number; quantity: number }[];
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }) {
    return this.require().checkout.sessions.create({
      mode: 'payment',
      customer_email: params.customerEmail,
      line_items: params.lineItems.map((li) => ({
        quantity: li.quantity,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: li.amountMinor,
          product_data: { name: li.name },
        },
      })),
      metadata: { orderId: String(params.orderId) },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('stripe.webhookSecret')!;
    return this.require().webhooks.constructEvent(payload, signature, secret);
  }
}
