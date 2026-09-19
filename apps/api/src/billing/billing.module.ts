import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Injectable,
  Module,
  Post,
  Req,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaClient, SubscriptionStatus, TenantStatus } from '@prisma/client';
import Stripe from 'stripe';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { StripeBillingService } from './stripe-billing.service';
import { TenantStatusCache } from '../common/tenant-status-cache.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { Principal } from '../common/enums';

/** Maps a Stripe subscription status to our own enum + the tenant-level status it implies. */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): { sub: SubscriptionStatus; tenant: TenantStatus } {
  switch (stripeStatus) {
    case 'trialing':
      return { sub: 'trialing', tenant: 'active' };
    case 'active':
      return { sub: 'active', tenant: 'active' };
    case 'past_due':
      return { sub: 'past_due', tenant: 'past_due' };
    case 'unpaid':
      return { sub: 'unpaid', tenant: 'past_due' };
    case 'canceled':
    case 'incomplete_expired':
      return { sub: 'canceled', tenant: 'suspended' };
    case 'incomplete':
    case 'paused':
    default:
      return { sub: 'incomplete', tenant: 'past_due' };
  }
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(RAW_PRISMA) private raw: PrismaClient,
    private stripeBilling: StripeBillingService,
    private tenantStatusCache: TenantStatusCache,
    private config: ConfigService,
  ) {}

  private async getOwnTenant(tenantId: number | null | undefined) {
    if (tenantId == null) {
      // Superadmin also has principal === 'admin' but no tenant of their own.
      throw new ForbiddenException('The platform superadmin has no tenant billing of its own');
    }
    const tenant = await this.raw.tenant.findUnique({
      where: { id: tenantId },
      include: { owner: { select: { email: true } }, subscription: { include: { plan: true } } },
    });
    if (!tenant) throw new ForbiddenException('No tenant on this account');
    return tenant;
  }

  async me(tenantId: number | null | undefined) {
    return this.getOwnTenant(tenantId);
  }

  async createCheckoutSession(tenantId: number | null | undefined) {
    const tenant = await this.getOwnTenant(tenantId);
    const plan = tenant.subscription?.plan;
    if (!plan?.stripePriceId) {
      throw new BadRequestException('This plan is not set up for online billing yet — contact the platform operator.');
    }
    const webUrl = this.config.get<string>('webUrl');
    const session = await this.stripeBilling.createCheckoutSession({
      tenantId: tenant.id,
      priceId: plan.stripePriceId,
      customerEmail: tenant.owner.email,
      successUrl: `${webUrl}/dashboard/admin/billing?success=1`,
      cancelUrl: `${webUrl}/dashboard/admin/billing?canceled=1`,
    });
    return { url: session.url };
  }

  async createPortalSession(tenantId: number | null | undefined) {
    const tenant = await this.getOwnTenant(tenantId);
    const customerId = tenant.subscription?.stripeCustomerId;
    if (!customerId) {
      throw new BadRequestException('No billing account on file yet — subscribe first.');
    }
    const webUrl = this.config.get<string>('webUrl');
    const session = await this.stripeBilling.createPortalSession(customerId, `${webUrl}/dashboard/admin/billing`);
    return { url: session.url };
  }

  /** `checkout.session.completed` for a `mode: 'subscription'` session. */
  async activateFromCheckout(tenantId: number, stripeCustomerId: string, stripeSubscriptionId: string) {
    const stripeSub = await this.stripeBilling.retrieveSubscription(stripeSubscriptionId);
    const { sub, tenant } = mapStripeStatus(stripeSub.status);
    await this.raw.subscription.update({
      where: { tenantId },
      data: {
        stripeCustomerId,
        stripeSubscriptionId,
        status: sub,
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });
    await this.raw.tenant.update({ where: { id: tenantId }, data: { status: tenant } });
    this.tenantStatusCache.invalidate(tenantId);
  }

  private async findTenantIdForSubscription(stripeSub: Stripe.Subscription): Promise<number | null> {
    const bySubId = await this.raw.subscription.findUnique({ where: { stripeSubscriptionId: stripeSub.id } });
    if (bySubId) return bySubId.tenantId;
    const metaTenantId = Number(stripeSub.metadata?.tenantId);
    return Number.isFinite(metaTenantId) ? metaTenantId : null;
  }

  async syncSubscription(stripeSub: Stripe.Subscription) {
    const tenantId = await this.findTenantIdForSubscription(stripeSub);
    if (!tenantId) return; // not one of ours, or arrived before checkout.session.completed — ignore
    const { sub, tenant } = mapStripeStatus(stripeSub.status);
    await this.raw.subscription.update({
      where: { tenantId },
      data: {
        stripeSubscriptionId: stripeSub.id,
        stripeCustomerId: typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id,
        status: sub,
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });
    await this.raw.tenant.update({ where: { id: tenantId }, data: { status: tenant } });
    this.tenantStatusCache.invalidate(tenantId);
  }

  async cancelSubscription(stripeSub: Stripe.Subscription) {
    const tenantId = await this.findTenantIdForSubscription(stripeSub);
    if (!tenantId) return;
    await this.raw.subscription.update({ where: { tenantId }, data: { status: 'canceled' } });
    await this.raw.tenant.update({ where: { id: tenantId }, data: { status: 'suspended' } });
    this.tenantStatusCache.invalidate(tenantId);
  }

  async markPastDue(stripeCustomerId: string) {
    const subscription = await this.raw.subscription.findFirst({ where: { stripeCustomerId } });
    if (!subscription) return;
    await this.raw.subscription.update({ where: { tenantId: subscription.tenantId }, data: { status: 'past_due' } });
    await this.raw.tenant.update({ where: { id: subscription.tenantId }, data: { status: 'past_due' } });
    this.tenantStatusCache.invalidate(subscription.tenantId);
  }
}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private billing: BillingService,
    private stripeBilling: StripeBillingService,
  ) {}

  @Roles(Principal.ADMIN)
  @Get('me')
  me(@CurrentUser('tenantId') tenantId: number) {
    return this.billing.me(tenantId);
  }

  @Roles(Principal.ADMIN)
  @Post('checkout')
  checkout(@CurrentUser('tenantId') tenantId: number) {
    return this.billing.createCheckoutSession(tenantId);
  }

  @Roles(Principal.ADMIN)
  @Post('portal')
  portal(@CurrentUser('tenantId') tenantId: number) {
    return this.billing.createPortalSession(tenantId);
  }

  /** Stripe calls this for platform-subscription events. Separate route and
   * signing secret from `orders`' `/checkout/webhook` (course purchases). */
  @Public()
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    if (!req.rawBody) throw new BadRequestException('Missing body');
    const event = this.stripeBilling.constructWebhookEvent(req.rawBody, signature);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = Number(session.metadata?.tenantId);
        if (tenantId && session.customer && session.subscription) {
          await this.billing.activateFromCheckout(
            tenantId,
            session.customer as string,
            session.subscription as string,
          );
        }
        break;
      }
      case 'customer.subscription.updated':
        await this.billing.syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.billing.cancelSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (typeof invoice.customer === 'string') await this.billing.markPastDue(invoice.customer);
        break;
      }
    }
    return { received: true };
  }
}

@Module({
  providers: [BillingService, StripeBillingService],
  controllers: [BillingController],
})
export class BillingModule {}
