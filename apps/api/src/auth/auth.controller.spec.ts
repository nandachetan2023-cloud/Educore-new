import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../users/users.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        UserService,
        {
          provide: JwtModule,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: PassportStrategy,
          useClass: JwtStrategy,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'student',
        phone: '+1234567890',
      };

      const result = {
        user: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          role: 'student',
        },
        token: 'some-jwt-token',
      };

      jest.spyOn(authService, 'register').mockResolvedValue(result);

      expect(await controller.register(registerDto)).toEqual(result);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const loginDto = {
        email: 'john@example.com',
        password: 'password123',
      };

      const result = {
        user: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          role: 'student',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      jest.spyOn(authService, 'login').mockResolvedValue(result);

      expect(await controller.login(loginDto)).toEqual(result);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('refreshToken', () => {
    it('should refresh a token', async () => {
      const refreshTokenDto = {
        refreshToken: 'refresh-token',
      };

      const result = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      jest.spyOn(authService, 'refreshToken').mockResolvedValue(result);

      expect(await controller.refreshToken(refreshTokenDto)).toEqual(result);
      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
    });
  });

  describe('getProfile', () => {
    it('should return current user profile', async () => {
      const user = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'student',
      };

      jest.spyOn(authService, 'getProfile').mockResolvedValue(user);

      expect(await controller.getProfile()).toEqual(user);
      expect(authService.getProfile).toHaveBeenCalled();
    });
  });
});