import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '@/auth/strategies/jwt.strategy';
import { UsersService } from '@/users/services/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: { getUserByEmail: jest.Mock };

  beforeEach(async () => {
    usersService = { getUserByEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => 'test-secret' } },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('should return the user of the token, as it is in the database now', async () => {
    const user = { userId: 7, email: 'ana@drinkhouse.rs' };
    usersService.getUserByEmail.mockResolvedValue(user);

    await expect(
      strategy.validate({ email: 'ana@drinkhouse.rs' }),
    ).resolves.toBe(user);
    expect(usersService.getUserByEmail).toHaveBeenCalledWith(
      'ana@drinkhouse.rs',
    );
  });

  it('should throw UnauthorizedException when the user of the token is gone', async () => {
    usersService.getUserByEmail.mockResolvedValue(null);

    await expect(
      strategy.validate({ email: 'obrisan@drinkhouse.rs' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
