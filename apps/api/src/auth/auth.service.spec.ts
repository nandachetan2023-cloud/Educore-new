import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        JwtService,
        PrismaService,
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'student',
        phone: '+1234567890',
      };

      const existingUser = null;
      const user = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'student',
        password: 'hashed-password',
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(existingUser);
      jest.spyOn(usersService, 'create').mockResolvedValue(user);
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      const result = await service.register(registerDto);

      expect(result).toEqual({
        user: { id: 1, name: 'John Doe', email: 'john@example.com', role: 'student' },
        token: 'token',
      });
    });

    it('should throw conflict exception for existing email', async () => {
      const registerDto = {
        name: 'John Doe',
        email: 'existing@example.com',
        password: 'password123',
        role: 'student',
      };

      const existingUser = { id: 1 };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginDto = {
        email: 'john@example.com',
        password: 'password123',
      };

      const user = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'student',
        password: 'hashed-password',
      };

      const resultUser = {
        ...user,
        password: undefined,
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(user);
      jest.spyOn(service, 'verifyPassword').mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        user: resultUser,
        accessToken: 'token',
        refreshToken: 'token',
      });
    });

    it('should throw unauthorized exception for invalid password', async () => {
      const loginDto = {
        email: 'john@example.com',
        password: 'wrong-password',
      };

      const user = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'student',
        password: 'hashed-password',
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(user);
      jest.spyOn(service, 'verifyPassword').mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password correctly', async () => {
      const password = 'password123';
      const hashedPassword = 'argon2-hash';

      jest.spyOn(args as any, 'hash').mockResolvedValue(hashedPassword);
      jest.spyOn(args as any, 'verify').mockResolvedValue(true);

      const isValid = await service.verifyPassword(password, hashedPassword);

      expect(isValid).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const refreshToken = 'refresh-token';
      const decoded = { userId: 1 };

      jest.spyOn(jwtService, 'verify').mockReturnValue(decoded);
      jest.spyOn(usersService, 'findById').mockResolvedValue({ id: 1, role: 'student' });
      jest.spyOn(jwtService, 'sign').mockReturnValue('new-token');

      const result = await service.refreshToken(refreshToken);

      expect(result).toEqual({
        accessToken: 'new-token',
        refreshToken: 'new-token',
      });
    });
  });
});