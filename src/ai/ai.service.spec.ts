import {
  BadGatewayException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '@/ai/ai.service';
import { AI_MAX_RETRIES, AI_MODEL } from '@/ai/ai.constants';
import { AiFile, PurchaseExtraction } from '@/ai/ai.types';
import { GeminiProvider } from '@/ai/providers/gemini.provider';
import { sleep } from '@/ai/helpers/limits.helpers';

jest.mock('@/ai/providers/gemini.provider');
// the pauses between the retries would make the tests slow
jest.mock('@/ai/helpers/limits.helpers', () => ({
  ...jest.requireActual('@/ai/helpers/limits.helpers'),
  sleep: jest.fn().mockResolvedValue(undefined),
}));

describe('AiService', () => {
  let service: AiService;
  let configService: { get: jest.Mock };
  let extractPurchaseItems: jest.Mock;

  const file: AiFile = {
    mimetype: 'application/pdf',
    buffer: Buffer.from('pdf'),
    originalname: 'petar.pdf',
  };
  const drinks = [{ drinkId: 128, name: 'FANTA 1.5L' }];
  const extraction: PurchaseExtraction = {
    title: 'PRIVATNA ZURKA Predracun 40/26',
    items: [{ name: 'FANTA 1.5L', quantity: 2, drinkId: null }],
    raw: { items: [{ name: 'FANTA 1.5L', quantity: 2 }] },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    extractPurchaseItems = jest.fn();
    (GeminiProvider as jest.Mock).mockImplementation(() => ({
      extractPurchaseItems,
    }));
    configService = { get: jest.fn().mockReturnValue('secret-key') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AiService);
  });

  describe('extractPurchaseItems', () => {
    it('should return what the provider read', async () => {
      extractPurchaseItems.mockResolvedValue(extraction);

      await expect(service.extractPurchaseItems(file, drinks)).resolves.toBe(
        extraction,
      );
      expect(extractPurchaseItems).toHaveBeenCalledWith(file, drinks);
    });

    it('should create the provider with the key and the model of the constants, once', async () => {
      extractPurchaseItems.mockResolvedValue(extraction);

      await service.extractPurchaseItems(file, drinks);
      await service.extractPurchaseItems(file, drinks);

      expect(configService.get).toHaveBeenCalledWith('GEMINI_API_KEY');
      expect(GeminiProvider).toHaveBeenCalledTimes(1);
      expect(GeminiProvider).toHaveBeenCalledWith('secret-key', AI_MODEL);
    });

    it('should throw ServiceUnavailableException when the key is not set', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(service.extractPurchaseItems(file, drinks)).rejects.toThrow(
        new ServiceUnavailableException('GEMINI_API_KEY is not set'),
      );
      expect(extractPurchaseItems).not.toHaveBeenCalled();
    });

    it('should try again when the AI is too busy and return the result when it works', async () => {
      extractPurchaseItems
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 429 })
        .mockResolvedValue(extraction);

      await expect(service.extractPurchaseItems(file, drinks)).resolves.toBe(
        extraction,
      );
      expect(extractPurchaseItems).toHaveBeenCalledTimes(3);
    });

    it('should wait longer before every retry', async () => {
      extractPurchaseItems
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue(extraction);

      await service.extractPurchaseItems(file, drinks);

      expect(sleep).toHaveBeenNthCalledWith(1, 1000);
      expect(sleep).toHaveBeenNthCalledWith(2, 2000);
    });

    it('should give up after the maximal number of retries', async () => {
      extractPurchaseItems.mockRejectedValue({ status: 503 });

      await expect(service.extractPurchaseItems(file, drinks)).rejects.toThrow(
        BadGatewayException,
      );
      // the first try and the retries
      expect(extractPurchaseItems).toHaveBeenCalledTimes(AI_MAX_RETRIES + 1);
    });

    it.each([401, 403])(
      'should throw ServiceUnavailableException without a retry for the status %i',
      async (status) => {
        extractPurchaseItems.mockRejectedValue({ status });

        await expect(
          service.extractPurchaseItems(file, drinks),
        ).rejects.toThrow(ServiceUnavailableException);
        expect(extractPurchaseItems).toHaveBeenCalledTimes(1);
      },
    );

    it('should throw ServiceUnavailableException when the quota is still over after the retries', async () => {
      extractPurchaseItems.mockRejectedValue({ status: 429 });

      await expect(service.extractPurchaseItems(file, drinks)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(extractPurchaseItems).toHaveBeenCalledTimes(AI_MAX_RETRIES + 1);
    });

    it('should throw BadGatewayException without a retry for any other error', async () => {
      extractPurchaseItems.mockRejectedValue(new Error('not a json'));

      await expect(service.extractPurchaseItems(file, drinks)).rejects.toThrow(
        new BadGatewayException('The document could not be read'),
      );
      expect(extractPurchaseItems).toHaveBeenCalledTimes(1);
    });
  });
});
