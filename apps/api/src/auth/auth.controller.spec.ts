import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Principal } from '../common/enums';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    loginFrontend: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    me: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      loginFrontend: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      me: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('delegates to authService.register', async () => {
      const dto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'student' as const,
      };
      const result = { accessToken: 'access', refreshToken: 'refresh', principal: Principal.STUDENT };
      authService.register.mockResolvedValue(result);

      expect(await controller.register(dto)).toEqual(result);
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('routes front-office login to loginFrontend', async () => {
      const dto = { email: 'john@example.com', password: 'password123' };
      const result = { accessToken: 'access', refreshToken: 'refresh', principal: Principal.STUDENT };
      authService.loginFrontend.mockResolvedValue(result);

      expect(await controller.login(dto)).toEqual(result);
      expect(authService.loginFrontend).toHaveBeenCalledWith(dto);
      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  describe('adminLogin', () => {
    it('routes admin login to login with the ADMIN principal', async () => {
      const dto = { email: 'admin@example.com', password: 'password123' };
      const result = { accessToken: 'access', refreshToken: 'refresh', principal: Principal.ADMIN };
      authService.login.mockResolvedValue(result);

      expect(await controller.adminLogin(dto)).toEqual(result);
      expect(authService.login).toHaveBeenCalledWith(dto, Principal.ADMIN);
    });
  });

  describe('refresh', () => {
    it('delegates the refresh token to authService.refresh', async () => {
      const dto = { refreshToken: 'refresh-token' };
      const result = { accessToken: 'new-access', refreshToken: 'new-refresh', principal: Principal.STUDENT };
      authService.refresh.mockResolvedValue(result);

      expect(await controller.refresh(dto)).toEqual(result);
      expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
    });
  });

  describe('me', () => {
    it('returns the profile of the current user', async () => {
      const user = {
        sub: 1,
        principal: Principal.STUDENT,
        email: 'john@example.com',
        tenantId: 7,
      };
      const profile = { id: 1, name: 'John Doe', principal: Principal.STUDENT };
      authService.me.mockResolvedValue(profile);

      expect(await controller.me(user)).toEqual(profile);
      expect(authService.me).toHaveBeenCalledWith(user);
    });
  });
});
