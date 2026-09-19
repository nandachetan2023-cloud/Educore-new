import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

/**
 * Thin wrapper around the Razorpay Orders REST API (no SDK dependency — just
 * fetch + Basic auth). Razorpay's checkout is a client-side widget: the
 * browser opens it with the order id this service creates, then posts the
 * resulting payment id/signature back here for verification.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly baseUrl = 'https://api.razorpay.com/v1';

  constructor(private config: ConfigService) {
    this.keyId = this.config.get<string>('razorpay.keyId') ?? '';
    this.keySecret = this.config.get<string>('razorpay.keySecret') ?? '';
    if (!this.keyId || !this.keySecret) {
      this.logger.warn('RAZORPAY_KEY_ID/SECRET not set — Razorpay checkout disabled.');
    }
  }

  get enabled() {
    return !!(this.keyId && this.keySecret);
  }
  get publicKeyId() {
    return this.keyId;
  }

  private require() {
    if (!this.enabled) throw new ServiceUnavailableException('Razorpay payments are not configured');
  }

  private authHeader() {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  /** Creates a Razorpay order (amount in the currency's minor unit, e.g. paise). */
  async createOrder(params: { orderId: number; currency: string; amountMinor: number }) {
    this.require();
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: params.amountMinor,
        currency: params.currency,
        receipt: `order-${params.orderId}`,
      }),
    });
    if (!res.ok) throw new ServiceUnavailableException('Could not create Razorpay order');
    return (await res.json()) as { id: string; amount: number; currency: string };
  }

  /** Verifies the HMAC-SHA256 signature Razorpay's checkout widget returns after payment. */
  verifySignature(params: { razorpayOrderId: string; razorpayPaymentId: string; signature: string }): boolean {
    this.require();
    const expected = createHmac('sha256', this.keySecret)
      .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
      .digest('hex');
    return expected === params.signature;
  }
}
