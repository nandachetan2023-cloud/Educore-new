import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { Principal } from '../common/enums';
import { AuthPrincipal } from '../common/decorators';
import { TenantSuspendedException } from '../common/tenant-suspended.exception';
import { TenantStatusCache } from '../common/tenant-status-cache.service';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(RAW_PRISMA) private raw: PrismaClient,
    private tenantStatusCache: TenantStatusCache,
  ) {}

  // ── Registration (students & instructors only; admins are seeded/created
  // by a Superadmin). Requires a resolvable tenant — see tenant-context.ts;
  // until Host-based resolution (Phase 4) lands, callers must send the dev
  // `X-Tenant-Id` header. ──
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: await argon2.hash(dto.password),
        role: dto.role,
        // Instructors require admin approval before they can publish.
        approveStatus: dto.role === 'instructor' ? 'pending' : 'approved',
      },
    });

    return this.issueTokens({
      sub: user.id,
      principal: dto.role as Principal,
      email: user.email,
      tenantId: user.tenantId,
    });
  }

  // ── Front-office login: principal is resolved from the user's own role ──
  async loginFrontend(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (!user || !(await argon2.verify(user.password, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.assertTenantActive(user.tenantId);
    return this.issueTokens({
      sub: user.id,
      principal: user.role as Principal,
      email: user.email,
      tenantId: user.tenantId,
    });
  }

  // ── Admin login (Admin table; Admin.email stays globally unique) ──
  async login(dto: LoginDto, principal: Principal.ADMIN) {
    const account = await this.prisma.admin.findUnique({ where: { email: dto.email } });

    if (!account || !(await argon2.verify(account.password, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (account.tenantId != null) {
      await this.assertTenantActive(account.tenantId);
    }

    return this.issueTokens({
      sub: account.id,
      principal,
      email: account.email,
      adminRole: account.role,
      tenantId: account.tenantId,
    });
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<AuthPrincipal>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      if (payload.tenantId != null) {
        await this.assertTenantActive(payload.tenantId);
      }
      return this.issueTokens({
        sub: payload.sub,
        principal: payload.principal,
        email: payload.email,
        adminRole: payload.adminRole,
        tenantId: payload.tenantId,
      });
    } catch (err) {
      if (err instanceof TenantSuspendedException) throw err;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Throws if the tenant behind this login/request isn't usable. Shares
   * `TenantStatusCache` with `TenantActiveGuard` so login and per-request
   * enforcement agree on the same ~30s-fresh status, and so suspending a
   * tenant from the Superadmin console (which invalidates the cache) takes
   * effect immediately rather than waiting out the TTL.
   */
  async assertTenantActive(tenantId: number) {
    const status = await this.tenantStatusCache.getStatus(tenantId, async () => {
      const tenant = await this.raw.tenant.findUnique({
        where: { id: tenantId },
        select: { status: true },
      });
      return tenant?.status ?? 'suspended';
    });
    if (status === 'suspended') {
      throw new TenantSuspendedException();
    }
  }

  async me(user: AuthPrincipal) {    if (user.principal === Principal.ADMIN) {
      const admin = await this.prisma.admin.findUnique({
        where: { id: user.sub },
        select: { id: true, name: true, email: true, image: true, bio: true, role: true, tenantId: true },
      });
      return { ...admin, principal: Principal.ADMIN, adminRole: admin?.role ?? 'admin' };
    }
    const account = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        headline: true,
        bio: true,
        role: true,
        approveStatus: true,
        wallet: true,
        tenantId: true,
      },
    });
    return { ...account, principal: user.principal };
  }

  /** Which social providers are configured (frontend hides the rest). */
  oauthProviders() {
    const oauth = this.config.get('oauth') as
      | { google?: { clientId?: string }; github?: { clientId?: string } }
      | undefined;
    return { google: !!oauth?.google?.clientId, github: !!oauth?.github?.clientId };
  }

  /**
   * Social sign-in: find-or-create a `User` from a verified OAuth profile.
   * Provider emails are pre-verified, so `emailVerifiedAt` is set on link.
   * Uses RAW_PRISMA with an explicit `tenantId` — OAuth callbacks arrive as
   * plain browser redirects with no tenant headers/CLS context.
   */
  async loginOAuth(
    profile: { provider: 'google' | 'github'; providerId: string; email: string; name: string; image?: string },
    tenantId: number | null,
    role: 'student' | 'instructor',
  ) {
    let tid = tenantId;
    if (tid == null) {
      const first = await this.raw.tenant.findFirst({
        where: { status: 'active' },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (!first) throw new UnauthorizedException('No workspace available for sign-in');
      tid = first.id;
    } else {
      await this.assertTenantActive(tid);
    }

    const idField = profile.provider === 'google' ? 'googleId' : 'githubId';
    const email = profile.email.toLowerCase();
    const name = profile.name?.trim() || email.split('@')[0];

    // 1. Already linked → log straight in (tenant follows the account).
    const linked = await this.raw.user.findUnique({ where: { [idField]: profile.providerId } as never });
    if (linked) {
      await this.assertTenantActive(linked.tenantId);
      return this.issueTokens({
        sub: linked.id,
        principal: linked.role as Principal,
        email: linked.email,
        tenantId: linked.tenantId,
      });
    }

    // 2. Email exists in this tenant → link the provider, verify the email.
    const existing = await this.raw.user.findFirst({ where: { tenantId: tid, email } });
    if (existing) {
      const updated = await this.raw.user.update({
        where: { id: existing.id },
        data: {
          [idField]: profile.providerId,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          image:
            existing.image?.includes('avatar') && profile.image ? profile.image : existing.image,
        } as never,
      });
      await this.assertTenantActive(updated.tenantId);
      return this.issueTokens({
        sub: updated.id,
        principal: updated.role as Principal,
        email: updated.email,
        tenantId: updated.tenantId,
      });
    }

    // 3. Brand-new account. OAuth proves email ownership, but instructor
    // publishing still needs admin approval (same as email registration).
    const created = await this.raw.user.create({
      data: {
        tenantId: tid,
        email,
        name,
        image: profile.image ?? '/default-files/avatar.png',
        password: await argon2.hash(`oauth:${profile.provider}:${profile.providerId}:${Date.now()}`),
        role,
        approveStatus: role === 'instructor' ? 'pending' : 'approved',
        emailVerifiedAt: new Date(),
        wallet: 0,
        [idField]: profile.providerId,
      } as never,
    });
    return this.issueTokens({
      sub: created.id,
      principal: created.role as Principal,
      email: created.email,
      tenantId: created.tenantId,
    });
  }

  private async issueTokens(payload: AuthPrincipal) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessTtl'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshTtl'),
      }),
    ]);
    return { accessToken, refreshToken, principal: payload.principal };
  }
}
