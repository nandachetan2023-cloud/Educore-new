import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Platform billing (Superadmin selling tenant subscriptions) — kept
 * deliberately separate from `payments/stripe.service.ts`, which handles
 * one-off `mode: 'payment'` checkout for students buying courses. This one
 * only ever creates `mode: 'subscription'` sessions and reads its own
 * webhook signing secret, so the two contexts can never be confused and
 * could even point at different Stripe accounts later.
 */
@Injectable()
export class StripeBillingService {
  private readonly logger = new Logger(StripeBillingService.name);
  private client: Stripe | null = null;

  constructor(private config: ConfigService) {
    const key = this.config.get<string>('stripe.secretKey');
    if (key) {
      this.client = new Stripe(key, { apiVersion: '2023-10-16' });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — platform billing disabled.');
    }
  }

  get enabled() {
    return this.client !== null;
  }

  private require(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException('Platform billing is not configured');
    }
    return this.client;
  }

  createProduct(name: string) {
    return this.require().products.create({ name });
  }

  createPrice(productId: string, unitAmountMinor: number, currency: string) {
    return this.require().prices.create({
      product: productId,
      unit_amount: unitAmountMinor,
      currency: currency.toLowerCase(),
      recurring: { interval: 'month' },
    });
  }

  /** Stripe prices are immutable — a plan price change creates a new Price and retires the old one. */
  deactivatePrice(priceId: string) {
    return this.require().prices.update(priceId, { active: false });
  }

  createCheckoutSession(params: {
    tenantId: number;
    priceId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    return this.require().checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.customerEmail,
      line_items: [{ price: params.priceId, quantity: 1 }],
      metadata: { tenantId: String(params.tenantId) },
      subscription_data: { metadata: { tenantId: String(params.tenantId) } },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  }

  createPortalSession(customerId: string, returnUrl: string) {
    return this.require().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  retrieveSubscription(id: string) {
    return this.require().subscriptions.retrieve(id);
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('stripe.platformWebhookSecret')!;
    return this.require().webhooks.constructEvent(payload, signature, secret);
  }
}
