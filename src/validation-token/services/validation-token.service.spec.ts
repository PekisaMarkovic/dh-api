import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ValidationToken } from '@/validation-token/entities/validation-token.entity';
import { ValidationTokenTypeEnums } from '@/validation-token/enums/VerificationTokenType';
import { ValidationTokenService } from '@/validation-token/services/validation-token.service';

describe('ValidationTokenService', () => {
  let service: ValidationTokenService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findBy: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((entity: Partial<ValidationToken>) => entity),
      save: jest.fn((entity: Partial<ValidationToken>) =>
        Promise.resolve(entity),
      ),
      find: jest.fn(),
      findOne: jest.fn(),
      findBy: jest.fn(),
      remove: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationTokenService,
        { provide: getRepositoryToken(ValidationToken), useValue: repository },
      ],
    }).compile();

    service = module.get(ValidationTokenService);
  });

  describe('createValidationToken', () => {
    const data = {
      email: 'ana@drinkhouse.rs',
      token: 'abc',
      validationTokenType: ValidationTokenTypeEnums.REFRESH,
    } as Parameters<ValidationTokenService['createValidationToken']>[0];

    it('should save the token that expires after the given time', async () => {
      const before = Date.now();

      const token = (await service.createValidationToken(
        data,
        60_000,
      )) as unknown as {
        expirationDate: number;
      };

      expect(token).toEqual(expect.objectContaining(data));
      expect(token.expirationDate).toBeGreaterThanOrEqual(before + 60_000);
      expect(token.expirationDate).toBeLessThanOrEqual(Date.now() + 60_000);
    });

    it('should return what the repository saved', async () => {
      const saved = { validationTokenId: 1 };
      repository.save.mockResolvedValue(saved);

      await expect(service.createValidationToken(data, 1000)).resolves.toBe(
        saved,
      );
    });
  });

  describe('getValidationTokens', () => {
    it('should return all the tokens', async () => {
      const tokens = [{ validationTokenId: 1 }];
      repository.find.mockResolvedValue(tokens);

      await expect(service.getValidationTokens()).resolves.toBe(tokens);
    });
  });

  describe('getValidationTokenById', () => {
    it('should return the token', async () => {
      const token = { validationTokenId: 1 };
      repository.findOne.mockResolvedValue(token);

      await expect(service.getValidationTokenById(1)).resolves.toBe(token);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { validationTokenId: 1 },
      });
    });

    it('should return null when there is no such token', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getValidationTokenById(99)).resolves.toBeNull();
    });
  });

  describe('getRefreshTokenByEmail', () => {
    it('should look only at the refresh tokens of the email', async () => {
      await service.getRefreshTokenByEmail('ana@drinkhouse.rs');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          email: 'ana@drinkhouse.rs',
          validationTokenType: ValidationTokenTypeEnums.REFRESH,
        },
      });
    });
  });

  describe('removeValidationTokenById', () => {
    it('should remove the token', async () => {
      const token = { validationTokenId: 1 };
      repository.findOne.mockResolvedValue(token);

      await expect(service.removeValidationTokenById(1)).resolves.toBe(token);
      expect(repository.remove).toHaveBeenCalledWith(token);
    });

    it('should throw NotFoundException when there is no such token', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.removeValidationTokenById(99)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('removeRefreshTokenByEmail', () => {
    it('should remove all the refresh tokens of the email', async () => {
      const tokens = [{ validationTokenId: 1 }, { validationTokenId: 2 }];
      repository.findBy.mockResolvedValue(tokens);

      await service.removeRefreshTokenByEmail('ana@drinkhouse.rs');

      expect(repository.findBy).toHaveBeenCalledWith({
        email: 'ana@drinkhouse.rs',
        validationTokenType: ValidationTokenTypeEnums.REFRESH,
      });
      expect(repository.remove).toHaveBeenCalledWith(tokens);
    });

    it('should not fail when the email has no tokens', async () => {
      repository.findBy.mockResolvedValue([]);

      await expect(
        service.removeRefreshTokenByEmail('ana@drinkhouse.rs'),
      ).resolves.toEqual([]);
    });
  });
});
