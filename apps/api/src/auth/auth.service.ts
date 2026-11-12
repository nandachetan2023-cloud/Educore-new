import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { MailService } from '../mail/mail.module';
import { Principal } from '../common/enums';
import { AuthPrincipal } from '../common/decorators';
import { TenantSuspendedException } from '../common/tenant-suspended.exception';
import { TenantStatusCache } from '../common/tenant-status-cache.service';
import { AuditService } from '../audit/audit.service';
import { RegisterDto, LoginDto } from './dto';
import { generateTwoFactorSecret, otpauthUrl, verifyTotp } from './two-factor.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(RAW_PRISMA) private raw: PrismaClient,
    private tenantStatusCache: TenantStatusCache,
    private audit: AuditService,
    private mail: MailService,
  ) {}

  // ── Registration (students & instructors only; admins are seeded/created
  // by a Superadmin). Requires a resolvable tenant — see tenant-context.ts;
  // until Host-based resolution (Phase 4) lands, callers must send the dev
  // `X-Tenant-Id` header. ──
  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    if (!dto.termsAccepted) {
      throw new BadRequestException('Please accept the terms to create an account');
    }
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

    // Non-blocking: the account is usable immediately, but a verification
    // email goes out so we can gate publishing on a confirmed address.
    await this.sendVerificationEmail(user).catch(() => {});

    return this.issueTokens({
      sub: user.id,
      principal: dto.role as Principal,
      email: user.email,
      tenantId: user.tenantId,
    });
  }

  /** Generates a token, stores it, and emails the verification link. */
  private async sendVerificationEmail(
    account: { id: number; email: string; name: string },
    kind: 'user' | 'admin' = 'user',
  ) {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    if (kind === 'admin') {
      await this.raw.admin.update({
        where: { id: account.id },
        data: { emailVerifyToken: token, emailVerifyExpires: expires },
      });
    } else {
      await this.raw.user.update({
        where: { id: account.id },
        data: { emailVerifyToken: token, emailVerifyExpires: expires },
      });
    }
    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3000';
    const link = `${webUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.mail.send(
      account.email,
      'Verify your email address',
      `<p>Hi ${account.name || 'there'},</p><p>Please confirm your email address by opening <a href="${link}">this link</a>. It expires in 24 hours.</p><p>If you did not create this account, you can ignore this email.</p>`,
    );
  }

  async verifyEmail(token: string) {
    const user = await this.raw.user.findFirst({
      where: { emailVerifyToken: token, emailVerifyExpires: { gt: new Date() } },
      select: { id: true },
    });
    if (user) {
      await this.raw.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date(), emailVerifyToken: null, emailVerifyExpires: null },
      });
      return { ok: true };
    }
    const admin = await this.raw.admin.findFirst({
      where: { emailVerifyToken: token, emailVerifyExpires: { gt: new Date() } },
      select: { id: true },
    });
    if (admin) {
      await this.raw.admin.update({
        where: { id: admin.id },
        data: { emailVerifiedAt: new Date(), emailVerifyToken: null, emailVerifyExpires: null },
      });
      return { ok: true };
    }
    throw new BadRequestException('This verification link is invalid or has expired');
  }

  /** Re-sends the verification email to the signed-in principal. */
  async resendVerification(principal: AuthPrincipal) {
    if (principal.principal === Principal.ADMIN) {
      const account = await this.raw.admin.findUnique({
        where: { id: principal.sub },
        select: { id: true, email: true, name: true, emailVerifiedAt: true },
      });
      if (!account) throw new NotFoundException('Account not found');
      if (account.emailVerifiedAt) return { ok: true, alreadyVerified: true };
      await this.sendVerificationEmail(account, 'admin');
      return { ok: true };
    }
    const account = await this.raw.user.findUnique({
      where: { id: principal.sub },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.emailVerifiedAt) return { ok: true, alreadyVerified: true };
    await this.sendVerificationEmail(account);
    return { ok: true };
  }

  // ── Front-office login: principal is resolved from the user's own role ──
  async loginFrontend(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (!user || !(await argon2.verify(user.password, dto.password))) {
      await this.audit.log({ action: 'auth.login_failed', entity: 'user', meta: { email: dto.email } });
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.assertTenantActive(user.tenantId);
    const rememberMe = dto.rememberMe === true;
    if (user.twoFactorEnabled) {
      const challengeToken = await this.jwt.signAsync(
        { sub: user.id, principal: user.role as Principal, email: user.email, tenantId: user.tenantId, purpose: '2fa', rememberMe },
        { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: '5m' },
      );
      return { requiresTwoFactor: true, challengeToken };
    }
    await this.audit.log({ action: 'auth.login', entity: 'user', entityId: user.id, actorId: user.id, actorName: user.email, actorRole: user.role });
    return this.issueTokens({
      sub: user.id,
      principal: user.role as Principal,
      email: user.email,
      tenantId: user.tenantId,
    }, rememberMe);
  }

  // ── Admin login (Admin table; Admin.email stays globally unique) ──
  async login(dto: LoginDto, principal: Principal.ADMIN) {
    const account = await this.prisma.admin.findUnique({ where: { email: dto.email } });

    if (!account || !(await argon2.verify(account.password, dto.password))) {
      await this.audit.log({ action: 'auth.login_failed', entity: 'admin', meta: { email: dto.email } });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (account.tenantId != null) {
      await this.assertTenantActive(account.tenantId);
    }

    const rememberMe = dto.rememberMe === true;
    if (account.twoFactorEnabled) {
      const challengeToken = await this.jwt.signAsync(
        { sub: account.id, principal, email: account.email, adminRole: account.role, tenantId: account.tenantId, purpose: '2fa', rememberMe },
        { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: '5m' },
      );
      return { requiresTwoFactor: true, challengeToken };
    }

    await this.audit.log({ action: 'auth.login', entity: 'admin', entityId: account.id, actorId: account.id, actorName: account.email, actorRole: `${principal}:${account.role}` });
    return this.issueTokens({
      sub: account.id,
      principal,
      email: account.email,
      adminRole: account.role,
      tenantId: account.tenantId,
    }, rememberMe);
  }

  async setupTwoFactor(principal: AuthPrincipal) {
    if (principal.principal === Principal.ADMIN) {
      const account = await this.raw.admin.findUnique({ where: { id: principal.sub }, select: { email: true } });
      if (!account) throw new NotFoundException('Account not found');
      const secret = generateTwoFactorSecret();
      await this.raw.admin.update({ where: { id: principal.sub }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
      return { secret, otpauthUrl: otpauthUrl(secret, account.email) };
    }
    const account = await this.raw.user.findUnique({ where: { id: principal.sub }, select: { email: true } });
    if (!account) throw new NotFoundException('Account not found');
    const secret = generateTwoFactorSecret();
    await this.raw.user.update({ where: { id: principal.sub }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
    return { secret, otpauthUrl: otpauthUrl(secret, account.email) };
  }

  async enableTwoFactor(principal: AuthPrincipal, code: string) {
    if (principal.principal === Principal.ADMIN) {
      const account = await this.raw.admin.findUnique({ where: { id: principal.sub }, select: { twoFactorSecret: true } });
      if (!account?.twoFactorSecret) throw new BadRequestException('Run 2FA setup first');
      if (!verifyTotp(account.twoFactorSecret, code)) throw new UnauthorizedException('Invalid 2FA code');
      await this.raw.admin.update({ where: { id: principal.sub }, data: { twoFactorEnabled: true } });
      return { ok: true };
    }
    const account = await this.raw.user.findUnique({ where: { id: principal.sub }, select: { twoFactorSecret: true } });
    if (!account?.twoFactorSecret) throw new BadRequestException('Run 2FA setup first');
    if (!verifyTotp(account.twoFactorSecret, code)) throw new UnauthorizedException('Invalid 2FA code');
    await this.raw.user.update({ where: { id: principal.sub }, data: { twoFactorEnabled: true } });
    return { ok: true };
  }

  async disableTwoFactor(principal: AuthPrincipal, code: string) {
    if (principal.principal === Principal.ADMIN) {
      const account = await this.raw.admin.findUnique({ where: { id: principal.sub }, select: { twoFactorSecret: true, twoFactorEnabled: true } });
      if (!account) throw new NotFoundException('Account not found');
      if (account.twoFactorEnabled) {
        if (!account.twoFactorSecret || !verifyTotp(account.twoFactorSecret, code)) throw new UnauthorizedException('Invalid 2FA code');
      }
      await this.raw.admin.update({ where: { id: principal.sub }, data: { twoFactorSecret: null, twoFactorEnabled: false } });
      return { ok: true };
    }
    const account = await this.raw.user.findUnique({ where: { id: principal.sub }, select: { twoFactorSecret: true, twoFactorEnabled: true } });
    if (!account) throw new NotFoundException('Account not found');
    if (account.twoFactorEnabled) {
      if (!account.twoFactorSecret || !verifyTotp(account.twoFactorSecret, code)) throw new UnauthorizedException('Invalid 2FA code');
    }
    await this.raw.user.update({ where: { id: principal.sub }, data: { twoFactorSecret: null, twoFactorEnabled: false } });
    return { ok: true };
  }

  async verifyTwoFactor(challengeToken: string, code: string) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(challengeToken, { secret: this.config.get<string>('jwt.refreshSecret') });
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA challenge');
    }
    if (payload?.purpose !== '2fa') throw new UnauthorizedException('Invalid 2FA challenge');

    if (payload.principal === Principal.ADMIN) {
      const account = await this.raw.admin.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, tenantId: true, twoFactorSecret: true, twoFactorEnabled: true },
      });
      if (!account || !account.twoFactorEnabled || !account.twoFactorSecret) throw new UnauthorizedException('2FA is not enabled');
      if (!verifyTotp(account.twoFactorSecret, code)) throw new UnauthorizedException('Invalid 2FA code');
      if (account.tenantId != null) await this.assertTenantActive(account.tenantId);
      await this.audit.log({ action: 'auth.login', entity: 'admin', entityId: account.id, actorId: account.id, actorName: account.email, actorRole: `${payload.principal}:${account.role}` });
      return this.issueTokens({
        sub: account.id,
        principal: Principal.ADMIN,
        email: account.email,
        adminRole: account.role,
        tenantId: account.tenantId,
      }, payload.rememberMe === true);
    }

    const account = await this.raw.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, tenantId: true, twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!account || !account.twoFactorEnabled || !account.twoFactorSecret) throw new UnauthorizedException('2FA is not enabled');
    if (!verifyTotp(account.twoFactorSecret, code)) throw new UnauthorizedException('Invalid 2FA code');
    await this.assertTenantActive(account.tenantId);
    await this.audit.log({ action: 'auth.login', entity: 'user', entityId: account.id, actorId: account.id, actorName: account.email, actorRole: account.role });
    return this.issueTokens({
      sub: account.id,
      principal: account.role as Principal,
      email: account.email,
      tenantId: account.tenantId,
    }, payload.rememberMe === true);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<AuthPrincipal & { purpose?: string; rememberMe?: boolean }>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      if (payload?.purpose === '2fa') throw new UnauthorizedException('Invalid refresh token');
      if (payload.tenantId != null) {
        await this.assertTenantActive(payload.tenantId);
      }
      return this.issueTokens({
        sub: payload.sub,
        principal: payload.principal,
        email: payload.email,
        adminRole: payload.adminRole,
        tenantId: payload.tenantId,
      }, payload.rememberMe === true);
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

  async forgotPassword(email: string, role: 'user' | 'admin' = 'user') {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:3000';
    const link = `${webUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const body = (name: string) =>
      `<p>Hi ${name || 'there'},</p><p>Someone requested a password reset for your account. Choose a new password by opening <a href="${link}">this link</a>. It expires in 1 hour.</p><p>If you did not request this, you can ignore this email — your password will not change.</p>`;

    if (role === 'admin') {
      const admin = await this.raw.admin.findFirst({
        where: { email },
        select: { id: true, email: true, name: true },
      });
      // Always return ok so the endpoint can't be used to enumerate accounts.
      if (!admin) return { ok: true };
      await this.raw.admin.update({
        where: { id: admin.id },
        data: { passwordResetToken: token, passwordResetExpires: expires },
      });
      await this.mail.send(admin.email, 'Reset your password', body(admin.name)).catch(() => {});
    } else {
      // Scope the lookup to the requesting workspace when one is resolved:
      // users are unique per (tenant, email), so an unscoped findFirst could
      // reset the wrong tenant's account.
      const user = await this.prisma.user.findFirst({
        where: { email },
        select: { id: true, email: true, name: true },
      });
      if (!user) return { ok: true };
      await this.raw.user.update({
        where: { id: user.id },
        data: { passwordResetToken: token, passwordResetExpires: expires },
      });
      await this.mail.send(user.email, 'Reset your password', body(user.name)).catch(() => {});
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.raw.user.findFirst({ where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } } });
    if (user) {
      const hash = await argon2.hash(password);
      await this.raw.user.update({ where: { id: user.id }, data: { password: hash, passwordResetToken: null, passwordResetExpires: null } });
      return { ok: true };
    }
    const admin = await this.raw.admin.findFirst({ where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } } });
    if (admin) {
      const hash = await argon2.hash(password);
      await this.raw.admin.update({ where: { id: admin.id }, data: { password: hash, passwordResetToken: null, passwordResetExpires: null } });
      return { ok: true };
    }
    throw new UnauthorizedException('Invalid or expired reset token');
  }

  /**
   * The email is the login identifier in both tables, so a new address must be
   * free across users *and* admins — otherwise a learner could take over an
   * admin's address (or vice versa).
   */
  private async assertEmailFree(email: string, exceptUserId?: number, exceptAdminId?: number) {
    const [asUser, asAdmin] = await Promise.all([
      this.raw.user.findFirst({
        where: { email, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
        select: { id: true },
      }),
      this.raw.admin.findFirst({
        where: { email, ...(exceptAdminId ? { id: { not: exceptAdminId } } : {}) },
        select: { id: true },
      }),
    ]);
    if (asUser) throw new ConflictException('An account already uses this email');
    if (asAdmin) throw new ConflictException('An admin account already uses this email');
  }

  /**
   * Change the email address on your own account. Requires the current
   * password, rejects an address another account already uses, and hands back
   * a fresh token pair so the session keeps working with the new address.
   */
  async changeEmail(principal: AuthPrincipal, currentPassword: string, newEmail: string) {
    const email = newEmail.trim().toLowerCase();
    if (principal.principal === Principal.ADMIN) {
      const account = await this.raw.admin.findUnique({ where: { id: principal.sub } });
      if (!account) throw new NotFoundException('Account not found');
      if (!(await argon2.verify(account.password, currentPassword))) {
        throw new UnauthorizedException('Your current password is incorrect');
      }
      await this.assertEmailFree(email, undefined, principal.sub);
      await this.raw.admin.update({ where: { id: principal.sub }, data: { email } });
      const tokens = await this.issueTokens({
        sub: principal.sub,
        principal: Principal.ADMIN,
        email,
        tenantId: account.tenantId,
        adminRole: account.role,
      });
      return { ok: true, email, ...tokens };
    }

    const account = await this.raw.user.findUnique({ where: { id: principal.sub } });
    if (!account) throw new NotFoundException('Account not found');
    if (!(await argon2.verify(account.password, currentPassword))) {
      throw new UnauthorizedException('Your current password is incorrect');
    }
    await this.assertEmailFree(email, principal.sub);
    await this.raw.user.update({ where: { id: principal.sub }, data: { email } });
    const tokens = await this.issueTokens({
      sub: principal.sub,
      principal: principal.principal,
      email,
      tenantId: account.tenantId,
    });
    return { ok: true, email, ...tokens };
  }

  /**
   * Change your own password. Works for every principal (student, instructor,
   * admin) and requires the current password so a hijacked session can't lock
   * the real owner out.
   */
  async changePassword(principal: AuthPrincipal, currentPassword: string, newPassword: string) {
    if (currentPassword === newPassword) {
      throw new BadRequestException('The new password must be different from the current one');
    }
    if (principal.principal === Principal.ADMIN) {
      const account = await this.raw.admin.findUnique({ where: { id: principal.sub } });
      if (!account) throw new NotFoundException('Account not found');
      if (!(await argon2.verify(account.password, currentPassword))) {
        throw new UnauthorizedException('Your current password is incorrect');
      }
      await this.raw.admin.update({
        where: { id: principal.sub },
        data: { password: await argon2.hash(newPassword) },
      });
      return { ok: true };
    }
    const account = await this.raw.user.findUnique({ where: { id: principal.sub } });
    if (!account) throw new NotFoundException('Account not found');
    if (!(await argon2.verify(account.password, currentPassword))) {
      throw new UnauthorizedException('Your current password is incorrect');
    }
    await this.raw.user.update({
      where: { id: principal.sub },
      data: { password: await argon2.hash(newPassword) },
    });
    return { ok: true };
  }

  async me(user: AuthPrincipal) {    if (user.principal === Principal.ADMIN) {
      const admin = await this.prisma.admin.findUnique({
        where: { id: user.sub },
        select: { id: true, name: true, email: true, image: true, bio: true, role: true, tenantId: true, twoFactorEnabled: true },
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
        twoFactorEnabled: true,
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

  /**
   * SAML sign-in: the IdP has already asserted the email address. Provision a
   * student on first use (or reuse an existing account in the same tenant) and
   * issue the same JWTs as every other login path.
   */
  async loginSaml(profile: { email: string; name?: string }, tenantId: number) {
    await this.assertTenantActive(tenantId);
    const email = profile.email.toLowerCase();
    const name = profile.name?.trim() || email.split('@')[0];

    const existing = await this.raw.user.findFirst({ where: { tenantId, email } });
    if (existing) {
      const user = existing.emailVerifiedAt
        ? existing
        : await this.raw.user.update({
            where: { id: existing.id },
            data: { emailVerifiedAt: new Date() },
          });
      return this.issueTokens({
        sub: user.id,
        principal: user.role as Principal,
        email: user.email,
        tenantId: user.tenantId,
      });
    }

    const created = await this.raw.user.create({
      data: {
        tenantId,
        email,
        name,
        image: '/default-files/avatar.png',
        password: await argon2.hash(`saml:${tenantId}:${email}:${Date.now()}`),
        role: 'student',
        approveStatus: 'approved',
        emailVerifiedAt: new Date(),
        wallet: 0,
      },
    });
    return this.issueTokens({
      sub: created.id,
      principal: created.role as Principal,
      email: created.email,
      tenantId: created.tenantId,
    });
  }

  private async issueTokens(payload: AuthPrincipal, rememberMe = true) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessTtl'),
      }),
      this.jwt.signAsync({ ...payload, rememberMe }, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: rememberMe
          ? this.config.get<string>('jwt.refreshTtl')
          : this.config.get<string>('jwt.sessionRefreshTtl'),
      }),
    ]);
    return { accessToken, refreshToken, principal: payload.principal };
  }
}
