import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService, PrismaConnection } from '../prisma/prisma.service';
import { RAW_PRISMA } from '../prisma/prisma.module';
import { TenantStatusCache } from '../common/tenant-status-cache.service';
import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantSuspendedException } from '../common/tenant-suspended.exception';
import { Principal } from '../common/enums';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: Record<string, jest.Mock>; admin: Record<string, jest.Mock> };
  let raw: { tenant: Record<string, jest.Mock> };
  let jwt: { verifyAsync: jest.Mock; signAsync: jest.Mock };
  let config: { get: jest.Mock };
  let tenantStatusCache: { getStatus: jest.Mock; invalidate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      admin: { findUnique: jest.fn() },
    };
    raw = { tenant: { findUnique: jest.fn(), findFirst: jest.fn() } };
    raw.tenant.findUnique.mockResolvedValue({ status: 'active' });
    jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 1, principal: Principal.STUDENT }),
      signAsync: jest.fn().mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token'),
    };
    config = { get: jest.fn((key: string) => `secret:${key}`) };
    tenantStatusCache = {
      getStatus: jest.fn((_id: number, loader: () => Promise<string>) => loader()),
      invalidate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AuthService, useClass: AuthService },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: RAW_PRISMA, useValue: raw },
        { provide: PrismaConnection, useValue: raw },
        { provide: TenantStatusCache, useValue: tenantStatusCache },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    jwt.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const dto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      role: 'student' as const,
    };

    it('registers a new user and issues tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 1,
        name: dto.name,
        email: dto.email,
        role: 'student',
        tenantId: 7,
      });

      const result = await service.register(dto);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: dto.name, email: dto.email, role: 'student' }),
      });
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        principal: 'student',
      });
    });

    it('throws ConflictException when the email is already registered', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('marks instructors as pending approval', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 2,
        role: 'instructor',
        email: dto.email,
        tenantId: 7,
      });

      await service.register({ ...dto, role: 'instructor' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ approveStatus: 'pending' }),
      });
    });
  });

  describe('loginFrontend', () => {
    const dto = { email: 'john@example.com', password: 'password123' };

    it('logs in a user with valid credentials', async () => {
      const user = {
        id: 1,
        email: dto.email,
        role: 'student',
        tenantId: 7,
        password: await argon2.hash(dto.password),
      };
      prisma.user.findFirst.mockResolvedValue(user);

      const result = await service.loginFrontend(dto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        principal: 'student',
      });
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.loginFrontend(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 1,
        email: dto.email,
        role: 'student',
        tenantId: 7,
        password: await argon2.hash('other-password'),
      });

      await expect(service.loginFrontend(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws TenantSuspendedException for a suspended tenant', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 1,
        email: dto.email,
        role: 'student',
        tenantId: 7,
        password: await argon2.hash(dto.password),
      });
      raw.tenant.findUnique.mockResolvedValue({ status: 'suspended' });

      await expect(service.loginFrontend(dto)).rejects.toThrow(TenantSuspendedException);
    });
  });

  describe('login (admin)', () => {
    const dto = { email: 'admin@example.com', password: 'password123' };

    it('logs in an admin with valid credentials', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: 9,
        email: dto.email,
        role: 'admin',
        tenantId: 7,
        password: await argon2.hash(dto.password),
      });

      const result = await service.login(dto, Principal.ADMIN);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        principal: Principal.ADMIN,
      });
    });

    it('throws UnauthorizedException for invalid credentials', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(service.login(dto, Principal.ADMIN)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('issues fresh tokens for a valid refresh token', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 1,
        principal: Principal.STUDENT,
        email: 'john@example.com',
        tenantId: 7,
      });

      const result = await service.refresh('refresh-token');

      expect(jwt.verifyAsync).toHaveBeenCalledWith('refresh-token', {
        secret: 'secret:jwt.refreshSecret',
      });
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        principal: Principal.STUDENT,
      });
    });

    it('throws UnauthorizedException for an invalid refresh token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

      await expect(service.refresh('bogus')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('assertTenantActive', () => {
    it('passes for an active tenant', async () => {
      raw.tenant.findUnique.mockResolvedValue({ status: 'active' });

      await expect(service.assertTenantActive(7)).resolves.toBeUndefined();
    });

    it('throws TenantSuspendedException for a suspended tenant', async () => {
      raw.tenant.findUnique.mockResolvedValue({ status: 'suspended' });

      await expect(service.assertTenantActive(7)).rejects.toThrow(TenantSuspendedException);
    });

    it('treats a missing tenant as suspended', async () => {
      raw.tenant.findUnique.mockResolvedValue(null);

      await expect(service.assertTenantActive(404)).rejects.toThrow(TenantSuspendedException);
    });
  });
});
