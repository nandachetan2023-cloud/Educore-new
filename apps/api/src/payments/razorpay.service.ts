import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const SETTING_PREFIX = 'razorpay.';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  enabled: boolean;
}

/**
 * Thin wrapper around the Razorpay Orders REST API (no SDK dependency — just
 * fetch + Basic auth). Razorpay's checkout is a client-side widget: the
 * browser opens it with the order id this service creates, then posts the
 * resulting payment id/signature back here for verification.
 *
 * Credentials come from the `settings` table (Admin → Settings → Payments),
 * which overrides the `.env` boot defaults. Reading them per call means the
 * admin screen takes effect without an API restart.
 */
@Injectable()
export class RazorpayService implements OnModuleInit {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly baseUrl = 'https://api.razorpay.com/v1';

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const cfg = await this.getConfig();
    if (cfg.enabled) {
      this.logger.log(`Razorpay enabled (key ${cfg.keyId}).`);
    } else {
      this.logger.warn('RAZORPAY_KEY_ID/SECRET not set — Razorpay checkout disabled.');
    }
  }

  /** Effective credentials: admin-entered values win over the `.env` defaults. */
  async getConfig(): Promise<RazorpayConfig> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { startsWith: SETTING_PREFIX } },
    });
    const overrides: Record<string, string> = {};
    for (const r of rows) {
      if (r.key && r.value != null && r.value !== '') {
        overrides[r.key.slice(SETTING_PREFIX.length)] = r.value;
      }
    }
    const keyId = overrides.keyId ?? this.config.get<string>('razorpay.keyId') ?? '';
    const keySecret = overrides.keySecret ?? this.config.get<string>('razorpay.keySecret') ?? '';
    return { keyId, keySecret, enabled: !!(keyId && keySecret) };
  }

  /** Storing an empty string clears the override and falls back to `.env`. */
  async setConfig(dto: Partial<Pick<RazorpayConfig, 'keyId' | 'keySecret'>>) {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    for (const [key, value] of entries) {
      const settingKey = `${SETTING_PREFIX}${key}`;
      if (value === '') {
        await this.prisma.setting.deleteMany({ where: { key: settingKey } });
        continue;
      }
      const existing = await this.prisma.setting.findFirst({ where: { key: settingKey } });
      if (existing) {
        await this.prisma.setting.update({ where: { id: existing.id }, data: { value: String(value) } });
      } else {
        await this.prisma.setting.create({ data: { key: settingKey, value: String(value) } });
      }
    }
    return this.getConfig();
  }

  private authHeader(cfg: RazorpayConfig) {
    return `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`;
  }

  private async require(): Promise<RazorpayConfig> {
    const cfg = await this.getConfig();
    if (!cfg.enabled) throw new ServiceUnavailableException('Razorpay payments are not configured');
    return cfg;
  }

  /** Read-only credential check, used by the admin "test connection" action. */
  async testConnection() {
    const cfg = await this.require();
    const res = await fetch(`${this.baseUrl}/orders?count=1`, {
      headers: { Authorization: this.authHeader(cfg) },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ServiceUnavailableException(`Razorpay rejected these credentials: ${body.slice(0, 200)}`);
    }
    return { ok: true, keyId: cfg.keyId };
  }

  /** Creates a Razorpay order (amount in the currency's minor unit, e.g. paise). */
  async createOrder(params: { orderId: number; currency: string; amountMinor: number }) {
    const cfg = await this.require();
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(cfg), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: params.amountMinor,
        currency: params.currency,
        receipt: `order-${params.orderId}`,
      }),
    });
    if (!res.ok) throw new ServiceUnavailableException('Could not create Razorpay order');
    return {
      ...((await res.json()) as { id: string; amount: number; currency: string }),
      keyId: cfg.keyId,
    };
  }

  /** Verifies the HMAC-SHA256 signature Razorpay's checkout widget returns after payment. */
  async verifySignature(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    signature: string;
  }): Promise<boolean> {
    const cfg = await this.getConfig();
    if (!cfg.enabled) return false;
    const expected = createHmac('sha256', cfg.keySecret)
      .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(params.signature ?? '');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}