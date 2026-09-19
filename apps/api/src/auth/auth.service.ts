import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../common/enums';
import { AuthPrincipal } from '../common/decorators';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ── Registration (students & instructors only; admins are seeded) ──
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
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
    });
  }

  // ── Front-office login: principal is resolved from the user's own role ──
  async loginFrontend(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await argon2.verify(user.password, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens({
      sub: user.id,
      principal: user.role as Principal,
      email: user.email,
    });
  }

  // ── Login for a specific principal (admin, or role-scoped) ──
  async login(dto: LoginDto, principal: Principal) {
    const account =
      principal === Principal.ADMIN
        ? await this.prisma.admin.findUnique({ where: { email: dto.email } })
        : await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!account || !(await argon2.verify(account.password, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // For the shared users table, ensure the requested principal matches role.
    if (principal !== Principal.ADMIN) {
      const role = (account as unknown as { role: string }).role;
      if (role !== principal) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    // Admins carry their tier (admin | super_admin) in the token.
    const adminRole =
      principal === Principal.ADMIN
        ? ((account as unknown as { role: 'admin' | 'super_admin' }).role ?? 'admin')
        : undefined;

    return this.issueTokens({
      sub: account.id,
      principal,
      email: account.email,
      adminRole,
    });
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<AuthPrincipal>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      return this.issueTokens({
        sub: payload.sub,
        principal: payload.principal,
        email: payload.email,
        adminRole: payload.adminRole,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async me(user: AuthPrincipal) {
    if (user.principal === Principal.ADMIN) {
      const admin = await this.prisma.admin.findUnique({
        where: { id: user.sub },
        select: { id: true, name: true, email: true, image: true, bio: true, role: true },
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
