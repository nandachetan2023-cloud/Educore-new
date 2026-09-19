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

  async me(user: AuthPrincipal) {
    if (user.principal === Principal.ADMIN) {
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
