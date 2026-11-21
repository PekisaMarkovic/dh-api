import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '@/auth/services/auth.service';
import { InvitationsService } from '@/invitations/services/invitations.service';
import { UsersService } from '@/users/services/users.service';
import { ValidationTokenTypeEnums } from '@/validation-token/enums/VerificationTokenType';
import { ValidationTokenService } from '@/validation-token/services/validation-token.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    getUserByEmail: jest.Mock;
    getUserByEmailForLogIn: jest.Mock;
    createInvitedUser: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verifyAsync: jest.Mock };
  let validationTokenService: {
    removeRefreshTokenByEmail: jest.Mock;
    getRefreshTokenByEmail: jest.Mock;
    createValidationToken: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let invitationsService: { findUsable: jest.Mock; markAccepted: jest.Mock };

  const user = {
    userId: 7,
    email: 'ana@drinkhouse.rs',
    firstName: 'Ana',
    lastName: 'Anic',
    language: 'sr',
    phoneNumber: '064',
    dateOfBirth: null,
    companyId: 1,
    roles: [{ name: 'admin' }],
  };

  beforeEach(async () => {
    usersService = {
      getUserByEmail: jest.fn().mockResolvedValue(user),
      getUserByEmailForLogIn: jest.fn(),
      createInvitedUser: jest.fn().mockResolvedValue(undefined),
    };
    // the access token and the refresh token are told apart by what is signed
    jwtService = {
      sign: jest.fn(
        (payload: { token?: string; validationTokenId?: number }) =>
          payload.validationTokenId ? 'refresh-jwt' : 'access-jwt',
      ),
      verifyAsync: jest.fn(),
    };
    validationTokenService = {
      removeRefreshTokenByEmail: jest.fn().mockResolvedValue(undefined),
      getRefreshTokenByEmail: jest.fn(),
      createValidationToken: jest.fn().mockResolvedValue({
        validationTokenId: 5,
        email: user.email,
        token: 'access-jwt',
        validationTokenType: ValidationTokenTypeEnums.REFRESH,
      }),
    };
    configService = { get: jest.fn().mockReturnValue('15m') };
    invitationsService = {
      findUsable: jest.fn(),
      markAccepted: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ValidationTokenService, useValue: validationTokenService },
        { provide: ConfigService, useValue: configService },
        { provide: InvitationsService, useValue: invitationsService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('validateUser', () => {
    it('should return the user without the password when the credentials are right', async () => {
      const password = await bcrypt.hash('tajna123', 4);
      usersService.getUserByEmailForLogIn.mockResolvedValue({
        ...user,
        password,
      });

      const result = await service.validateUser({
        email: user.email,
        password: 'tajna123',
      });

      expect(result).toEqual(expect.objectContaining({ email: user.email }));
      expect(result).not.toHaveProperty('password');
    });

    it('should return null when there is no user with the email', async () => {
      usersService.getUserByEmailForLogIn.mockResolvedValue(null);

      await expect(
        service.validateUser({ email: 'nema@drinkhouse.rs', password: 'x' }),
      ).resolves.toBeNull();
    });

    it('should return null when the password is wrong', async () => {
      const password = await bcrypt.hash('tajna123', 4);
      usersService.getUserByEmailForLogIn.mockResolvedValue({
        ...user,
        password,
      });

      await expect(
        service.validateUser({ email: user.email, password: 'pogresna' }),
      ).resolves.toBeNull();
    });

    it('should return null for a user without a password (an invitation that was not finished)', async () => {
      usersService.getUserByEmailForLogIn.mockResolvedValue({
        ...user,
        password: null,
      });

      await expect(
        service.validateUser({ email: user.email, password: 'x' }),
      ).resolves.toBeNull();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException when there is no such user', async () => {
      usersService.getUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nema@drinkhouse.rs' }),
      ).rejects.toThrow(new UnauthorizedException('User not found'));
      expect(
        validationTokenService.createValidationToken,
      ).not.toHaveBeenCalled();
    });

    it('should remove the old refresh tokens, so only one device is logged in', async () => {
      await service.login({ email: user.email });

      expect(
        validationTokenService.removeRefreshTokenByEmail,
      ).toHaveBeenCalledWith(user.email);
    });

    it('should return the access token and the refresh token', async () => {
      await expect(service.login({ email: user.email })).resolves.toEqual({
        access_token: 'access-jwt',
        refresh_token: 'refresh-jwt',
      });
    });

    it('should put who the user is, their roles and company in the access token', async () => {
      await service.login({ email: user.email });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          email: user.email,
          sub: 7,
          roles: user.roles,
          companyId: 1,
          firstName: 'Ana',
          language: 'sr',
        }),
      );
    });

    it('should give a user without roles an empty list of roles', async () => {
      usersService.getUserByEmail.mockResolvedValue({
        ...user,
        roles: undefined,
      });

      await service.login({ email: user.email });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ roles: [] }),
      );
    });

    it('should keep the refresh token in the database for the time set in the environment', async () => {
      await service.login({ email: user.email });

      expect(configService.get).toHaveBeenCalledWith(
        'JWT_REFRESH_EXPIRE',
        '30m',
      );
      expect(validationTokenService.createValidationToken).toHaveBeenCalledWith(
        {
          email: user.email,
          token: 'access-jwt',
          validationTokenType: ValidationTokenTypeEnums.REFRESH,
        },
        15 * 60 * 1000,
      );
    });

    it('should sign the refresh token for the same time, and not put the access token in it', async () => {
      await service.login({ email: user.email });

      expect(jwtService.sign).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ token: expect.anything() }),
        { expiresIn: '15m' },
      );
    });

    it('should use 30 minutes when the time in the environment is not readable', async () => {
      configService.get.mockReturnValue('soon');

      await service.login({ email: user.email });

      expect(validationTokenService.createValidationToken).toHaveBeenCalledWith(
        expect.anything(),
        30 * 60 * 1000,
      );
    });
  });

  describe('firstTimeRegister', () => {
    const dto = {
      invitationId: '0b8f3c8e-5a0e-4d57-9b9c-0d1f5a3c7a11',
      firstName: 'Novi',
      lastName: 'Radnik',
      password: 'tajna123',
    };
    const invitation = { email: 'novi@drinkhouse.rs', companyId: 1 };

    beforeEach(() => {
      invitationsService.findUsable.mockResolvedValue(invitation);
      usersService.getUserByEmail
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ ...user, email: invitation.email });
    });

    it('should throw BadRequestException when the invitation can not be used', async () => {
      invitationsService.findUsable.mockResolvedValue(null);

      await expect(service.firstTimeRegister(dto)).rejects.toThrow(
        new BadRequestException('Invitation is not valid'),
      );
      expect(usersService.createInvitedUser).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the user already exists', async () => {
      usersService.getUserByEmail.mockReset().mockResolvedValue(user);

      await expect(service.firstTimeRegister(dto)).rejects.toThrow(
        new ConflictException('User already exists'),
      );
      expect(usersService.createInvitedUser).not.toHaveBeenCalled();
    });

    it('should create the user with the email and the company of the invitation, not of the request', async () => {
      await service.firstTimeRegister(dto);

      expect(invitationsService.findUsable).toHaveBeenCalledWith(
        dto.invitationId,
      );
      expect(usersService.createInvitedUser).toHaveBeenCalledWith(
        'novi@drinkhouse.rs',
        { firstName: 'Novi', lastName: 'Radnik', password: 'tajna123' },
        1,
      );
    });

    it('should mark the invitation as used, so the link works only once', async () => {
      await service.firstTimeRegister(dto);

      expect(invitationsService.markAccepted).toHaveBeenCalledWith(invitation);
    });

    it('should log the new user in', async () => {
      await expect(service.firstTimeRegister(dto)).resolves.toEqual({
        access_token: 'access-jwt',
        refresh_token: 'refresh-jwt',
      });
    });
  });

  describe('isUserTokenValid', () => {
    it('should be true for a token that is valid', async () => {
      jwtService.verifyAsync.mockResolvedValue({});

      await expect(service.isUserTokenValid('token')).resolves.toBe(true);
    });

    it('should be false for a token that is not valid or expired', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.isUserTokenValid('token')).resolves.toBe(false);
    });
  });

  describe('logout', () => {
    it('should remove the refresh tokens of the user', async () => {
      await service.logout(user.email);

      expect(
        validationTokenService.removeRefreshTokenByEmail,
      ).toHaveBeenCalledWith(user.email);
    });
  });

  describe('refreshToken', () => {
    const payload = { email: user.email, validationTokenId: 5 };
    const dbToken = {
      validationTokenId: 5,
      email: user.email,
      expirationDate: Date.now() + 60_000,
    };

    beforeEach(() => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      validationTokenService.getRefreshTokenByEmail.mockResolvedValue(dbToken);
    });

    it('should throw UnauthorizedException when the token is not valid or expired', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.refreshToken('bad')).rejects.toThrow(
        new UnauthorizedException('Refresh token is not valid'),
      );
    });

    it('should throw UnauthorizedException when the user is gone', async () => {
      usersService.getUserByEmail.mockResolvedValue(null);

      await expect(service.refreshToken('token')).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should throw UnauthorizedException when the user is logged out, so there is no token in the database', async () => {
      validationTokenService.getRefreshTokenByEmail.mockResolvedValue(null);

      await expect(service.refreshToken('token')).rejects.toThrow(
        new UnauthorizedException('Refresh token not found'),
      );
    });

    it('should throw UnauthorizedException for an old token, after the user logged in again', async () => {
      validationTokenService.getRefreshTokenByEmail.mockResolvedValue({
        ...dbToken,
        validationTokenId: 6,
      });

      await expect(service.refreshToken('token')).rejects.toThrow(
        new UnauthorizedException('Refresh token not found'),
      );
    });

    it('should throw UnauthorizedException when the token in the database is expired', async () => {
      validationTokenService.getRefreshTokenByEmail.mockResolvedValue({
        ...dbToken,
        expirationDate: Date.now() - 1000,
      });

      await expect(service.refreshToken('token')).rejects.toThrow(
        new UnauthorizedException('Refresh token expired'),
      );
    });

    it('should read the expiry of the database, which comes as a string', async () => {
      validationTokenService.getRefreshTokenByEmail.mockResolvedValue({
        ...dbToken,
        expirationDate: String(Date.now() + 60_000),
      });

      await expect(service.refreshToken('token')).resolves.toBeDefined();
    });

    it('should use the token only once: the old one is removed and new tokens are returned', async () => {
      const result = await service.refreshToken('token');

      expect(
        validationTokenService.removeRefreshTokenByEmail,
      ).toHaveBeenCalledWith(user.email);
      expect(result).toEqual({
        access_token: 'access-jwt',
        refresh_token: 'refresh-jwt',
      });
    });
  });
});
