import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin wrapper around the PayPal Orders v2 REST API (no SDK dependency —
 * just fetch + OAuth2 client-credentials). Lazily degrades: if no client
 * id/secret is configured, `enabled` is false and callers should hide the
 * PayPal option rather than call into this service.
 */
@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;

  constructor(private config: ConfigService) {
    this.clientId = this.config.get<string>('paypal.clientId') ?? '';
    this.clientSecret = this.config.get<string>('paypal.clientSecret') ?? '';
    this.baseUrl =
      this.config.get<string>('paypal.mode') === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('PAYPAL_CLIENT_ID/SECRET not set — PayPal checkout disabled.');
    }
  }

  get enabled() {
    return !!(this.clientId && this.clientSecret);
  }

  private require() {
    if (!this.enabled) throw new ServiceUnavailableException('PayPal payments are not configured');
  }

  private async accessToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new ServiceUnavailableException('Could not authenticate with PayPal');
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  /** Creates a PayPal order and returns its id + the buyer-facing approval URL. */
  async createOrder(params: {
    orderId: number;
    currency: string;
    amount: number;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; approveUrl: string }> {
    this.require();
    const token = await this.accessToken();
    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: String(params.orderId),
            amount: { currency_code: params.currency, value: params.amount.toFixed(2) },
          },
        ],
        application_context: {
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
          user_action: 'PAY_NOW',
        },
      }),
    });
    if (!res.ok) throw new ServiceUnavailableException('Could not create PayPal order');
    const data = (await res.json()) as { id: string; links: { rel: string; href: string }[] };
    const approve = data.links.find((l) => l.rel === 'approve');
    if (!approve) throw new ServiceUnavailableException('PayPal did not return an approval link');
    return { id: data.id, approveUrl: approve.href };
  }

  /** Captures a previously-approved PayPal order. Returns the capture id (used as transactionId). */
  async captureOrder(paypalOrderId: string): Promise<string> {
    this.require();
    const token = await this.accessToken();
    const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new ServiceUnavailableException('Could not capture PayPal payment');
    const data = (await res.json()) as {
      status: string;
      purchase_units: { payments: { captures: { id: string }[] } }[];
    };
    if (data.status !== 'COMPLETED') throw new ServiceUnavailableException('PayPal payment was not completed');
    return data.purchase_units[0]?.payments?.captures?.[0]?.id ?? paypalOrderId;
  }
}
