import { BadRequestException, Controller, Get, Inject, Param, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { Public } from '../common/decorators';

type Provider = 'google' | 'github';

interface OAuthState {
  tenant?: number;
  role?: 'student' | 'instructor';
}

interface OAuthProfile {
  provider: Provider;
  providerId: string;
  email: string;
  name: string;
  image?: string;
}

/**
 * Social login (Google + GitHub). Manual authorization-code flow — no extra
 * passport strategies needed:
 *
 *   1. Frontend links to `GET /auth/oauth/:provider?tenant=&role=`
 *   2. We 302-redirect to the provider with an HMAC-signed `state`
 *      (carries tenant + requested role, tamper-proof).
 *   3. Provider calls back to `GET /auth/oauth/:provider/callback`;
 *      we exchange the code, fetch the profile, find-or-create the user
 *      (`AuthService.loginOAuth`), and 302 to the web callback page with
 *      fresh JWTs: `{WEB_URL}/auth/callback?accessToken=…&refreshToken=…`.
 *
 * Providers with empty Client IDs are treated as disabled: the start
 * endpoint 400s and `GET /auth/oauth/providers` reports them off so the
 * frontend can hide those buttons.
 */
@ApiTags('auth')
@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
    @Inject(RAW_PRISMA) private raw: PrismaClient,
  ) {}

  @Public()
  @Get('providers')
  providers() {
    return this.auth.oauthProviders();
  }

  @Public()
  @Get(':provider')
  async start(
    @Param('provider') provider: string,
    @Query('tenant') tenant: string | undefined,
    @Query('domain') domain: string | undefined,
    @Query('role') role: string | undefined,
    @Res() res: Response,
  ) {
    this.assertProvider(provider);
    const creds = this.creds(provider);
    if (!creds.clientId) throw new BadRequestException(`${provider} login is not configured`);

    let tenantId = tenant ? Number(tenant) : undefined;
    if ((tenantId == null || !Number.isFinite(tenantId)) && domain) {
      const match = await this.raw.tenant.findFirst({
        where: { customDomain: domain.toLowerCase(), domainStatus: 'verified' },
        select: { id: true },
      });
      if (match) tenantId = match.id;
    }
    const state = this.signState({
      tenant: tenantId != null && Number.isFinite(tenantId) ? tenantId : undefined,
      role: role === 'instructor' ? 'instructor' : 'student',
    });
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: this.callbackUrl(provider),
      response_type: 'code',
      scope: provider === 'google' ? 'openid email profile' : 'read:user user:email',
      state,
      ...(provider === 'google' ? { access_type: 'online', prompt: 'select_account' } : {}),
    });
    const base =
      provider === 'google'
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://github.com/login/oauth/authorize';
    return res.redirect(`${base}?${params.toString()}`);
  }

  @Public()
  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const webUrl = this.config.get<string>('oauth.webUrl') ?? 'http://localhost:3000';
    const fail = (reason: string) =>
      res.redirect(`${webUrl}/login?error=${encodeURIComponent(reason)}`);
    try {
      this.assertProvider(provider);
      if (error) return fail('oauth_denied');
      if (!code || !state) return fail('oauth_failed');
      const { tenant, role } = this.verifyState(state);
      const creds = this.creds(provider);
      if (!creds.clientId || !creds.clientSecret) return fail('oauth_failed');

      const accessToken = await this.exchangeCode(provider, code, creds);
      const profile = await this.fetchProfile(provider, accessToken);
      const tokens = await this.auth.loginOAuth(
        profile,
        Number.isFinite(tenant as number) ? (tenant as number) : null,
        role === 'instructor' ? 'instructor' : 'student',
      );
      const params = new URLSearchParams({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        principal: tokens.principal,
      });
      return res.redirect(`${webUrl}/auth/callback?${params.toString()}`);
    } catch {
      return fail('oauth_failed');
    }
  }

  // ── helpers ──────────────────────────────────────────────

  private assertProvider(provider: string): asserts provider is Provider {
    if (provider !== 'google' && provider !== 'github') {
      throw new BadRequestException('Unknown provider');
    }
  }

  private creds(provider: Provider) {
    const oauth = this.config.get('oauth') as {
      google?: { clientId?: string; clientSecret?: string };
      github?: { clientId?: string; clientSecret?: string };
    };
    return provider === 'google'
      ? { clientId: oauth?.google?.clientId ?? '', clientSecret: oauth?.google?.clientSecret ?? '' }
      : { clientId: oauth?.github?.clientId ?? '', clientSecret: oauth?.github?.clientSecret ?? '' };
  }

  private callbackUrl(provider: Provider) {
    const base = this.config.get<string>('oauth.callbackBase') ?? 'http://localhost:4000';
    return `${base.replace(/\/$/, '')}/api/auth/oauth/${provider}/callback`;
  }

  private secret() {
    return (
      this.config.get<string>('jwt.accessSecret') ?? 'dev-access-secret'
    );
  }

  private signState(state: OAuthState): string {
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    const sig = createHmac('sha256', this.secret()).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyState(state: string): OAuthState {
    const [payload, sig] = state.split('.');
    if (!payload || !sig) throw new BadRequestException('Invalid state');
    const expected = createHmac('sha256', this.secret()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid state');
    }
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OAuthState;
    return {
      tenant: typeof parsed.tenant === 'number' ? parsed.tenant : undefined,
      role: parsed.role === 'instructor' ? 'instructor' : 'student',
    };
  }

  private async exchangeCode(
    provider: Provider,
    code: string,
    creds: { clientId: string; clientSecret: string },
  ): Promise<string> {
    if (provider === 'google') {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          redirect_uri: this.callbackUrl(provider),
          grant_type: 'authorization_code',
        }),
      });
      const body = (await res.json()) as { access_token?: string; error?: string };
      if (!res.ok || !body.access_token) throw new Error('Code exchange failed');
      return body.access_token;
    }
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: this.callbackUrl(provider),
      }),
    });
    const body = (await res.json()) as { access_token?: string; error?: string };
    if (!res.ok || !body.access_token) throw new Error('Code exchange failed');
    return body.access_token;
  }

  private async fetchProfile(provider: Provider, accessToken: string): Promise<OAuthProfile> {
    if (provider === 'google') {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
      };
      if (!res.ok || !body.sub || !body.email) throw new Error('Profile fetch failed');
      if (body.email_verified === false) throw new Error('Email not verified');
      return {
        provider,
        providerId: body.sub,
        email: body.email,
        name: body.name ?? body.email,
        image: body.picture,
      };
    }
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' };
    const [meRes, mailRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers }),
      fetch('https://api.github.com/user/emails', { headers }),
    ]);
    const me = (await meRes.json()) as { id?: number; name?: string; login?: string; avatar_url?: string };
    const mails = (await mailRes.json()) as { email?: string; primary?: boolean; verified?: boolean }[];
    if (!meRes.ok || !me.id) throw new Error('Profile fetch failed');
    const email =
      (Array.isArray(mails) ? mails.find((m) => m.primary && m.verified)?.email : undefined) ??
      (Array.isArray(mails) ? mails.find((m) => m.verified)?.email : undefined);
    if (!email) throw new Error('No verified email');
    return {
      provider,
      providerId: String(me.id),
      email,
      name: me.name ?? me.login ?? email,
      image: me.avatar_url,
    };
  }
}
