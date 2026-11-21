import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/auth/services/auth.service';
import { LocalStrategy } from '@/auth/strategies/local.strategy';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: { validateUser: jest.Mock };

  beforeEach(async () => {
    authService = { validateUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    strategy = module.get(LocalStrategy);
  });

  it('should return the user when the email and the password are right', async () => {
    const user = { userId: 7 };
    authService.validateUser.mockResolvedValue(user);

    await expect(
      strategy.validate('ana@drinkhouse.rs', 'tajna123'),
    ).resolves.toBe(user);
    expect(authService.validateUser).toHaveBeenCalledWith({
      email: 'ana@drinkhouse.rs',
      password: 'tajna123',
    });
  });

  it('should throw UnauthorizedException when they are not, without saying which one is wrong', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(
      strategy.validate('ana@drinkhouse.rs', 'pogresna'),
    ).rejects.toThrow(
      new UnauthorizedException('Invalid email or password. Please try again.'),
    );
  });
});
