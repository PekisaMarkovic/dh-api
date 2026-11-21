import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '@/auth/controllers/auth.controller';
import { AuthService } from '@/auth/services/auth.service';
import { User } from '@/users/entities/user.entity';
import { UsersService } from '@/users/services/users.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    refreshToken: jest.Mock;
    firstTimeRegister: jest.Mock;
    isUserTokenValid: jest.Mock;
    logout: jest.Mock;
  };

  const tokens = { access_token: 'a', refresh_token: 'r' };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue(tokens),
      refreshToken: jest.fn().mockResolvedValue(tokens),
      firstTimeRegister: jest.fn().mockResolvedValue(tokens),
      isUserTokenValid: jest.fn(),
      logout: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: {} },
      ],
    })
      // the guard of the log in is tested on its own
      .overrideGuard((await import('@/auth/guards')).LocalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
  });

  describe('login', () => {
    it('should return the tokens', async () => {
      const body = { email: 'ana@drinkhouse.rs', password: 'tajna123' };

      await expect(controller.login(body)).resolves.toBe(tokens);
      expect(authService.login).toHaveBeenCalledWith(body);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens', async () => {
      await expect(
        controller.refreshToken({ refreshToken: 'r' }),
      ).resolves.toBe(tokens);
      expect(authService.refreshToken).toHaveBeenCalledWith('r');
    });

    it('should throw UnauthorizedException when there is no refresh token', async () => {
      await expect(
        controller.refreshToken({ refreshToken: '' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(authService.refreshToken).not.toHaveBeenCalled();
    });
  });

  describe('firstTimeRegister', () => {
    it('should return the tokens of the new user', async () => {
      const dto = {
        invitationId: 'id',
        firstName: 'Novi',
        lastName: 'Radnik',
        password: 'tajna123',
      };

      await expect(controller.firstTimeRegister(dto)).resolves.toBe(tokens);
      expect(authService.firstTimeRegister).toHaveBeenCalledWith(dto);
    });
  });

  describe('isUserTokenValid', () => {
    const request = (authorization?: string) =>
      ({ headers: { authorization } }) as unknown as Request;

    it('should check the token of the header', async () => {
      authService.isUserTokenValid.mockResolvedValue(true);

      await expect(
        controller.isUserTokenValid(request('Bearer abc')),
      ).resolves.toBe(true);
      expect(authService.isUserTokenValid).toHaveBeenCalledWith('abc');
    });

    it('should be false when there is no header', () => {
      expect(controller.isUserTokenValid(request(undefined))).toBe(false);
      expect(authService.isUserTokenValid).not.toHaveBeenCalled();
    });

    it('should check an empty token when the header has no token', () => {
      controller.isUserTokenValid(request('Bearer'));

      expect(authService.isUserTokenValid).toHaveBeenCalledWith('');
    });
  });

  describe('logout', () => {
    it('should remove the refresh tokens of the user and return true', async () => {
      await expect(
        controller.logout({ email: 'ana@drinkhouse.rs' } as User),
      ).resolves.toBe(true);
      expect(authService.logout).toHaveBeenCalledWith('ana@drinkhouse.rs');
    });
  });
});
