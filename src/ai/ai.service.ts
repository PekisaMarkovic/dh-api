import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AI_MAX_CONCURRENT_REQUESTS,
  AI_MAX_RETRIES,
  AI_MODEL,
  AI_RETRY_BASE_DELAY_MS,
} from '@/ai/ai.constants';
import {
  AiFile,
  AiProvider,
  KnownDrink,
  PurchaseExtraction,
} from '@/ai/ai.types';
import { GeminiProvider } from '@/ai/providers/gemini.provider';
import {
  isRetryable,
  Semaphore,
  sleep,
  statusOf,
} from '@/ai/helpers/limits.helpers';

/**
 * The one place the app talks to an AI (Gemini). The model and the limits are in
 * ai.constants.ts, the key is GEMINI_API_KEY.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly limit = new Semaphore(AI_MAX_CONCURRENT_REQUESTS);
  private provider?: AiProvider;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Reads the drinks and their quantities from an image or a PDF and matches them to the given drinks
   * @throws ServiceUnavailableException if the AI is not set up, has no quota or the key is wrong
   * @throws BadGatewayException if the AI fails or returns rubbish
   */
  async extractPurchaseItems(
    file: AiFile,
    drinks: KnownDrink[],
  ): Promise<PurchaseExtraction> {
    const provider = this.getProvider();

    return this.limit.run(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await provider.extractPurchaseItems(file, drinks);
        } catch (error) {
          if (isRetryable(error) && attempt < AI_MAX_RETRIES) {
            const delay = AI_RETRY_BASE_DELAY_MS * 2 ** attempt;
            this.logger.warn(
              `AI request failed (${statusOf(error)}), retry ${attempt + 1}/${AI_MAX_RETRIES} in ${delay}ms`,
            );
            await sleep(delay);
            continue;
          }

          this.logger.error('AI request failed', error);

          const status = statusOf(error);
          if (status === 401 || status === 403 || status === 429) {
            // no quota or a wrong key, nothing the user can fix
            throw new ServiceUnavailableException(
              'The document reader is not available, contact the administrator',
            );
          }

          throw new BadGatewayException('The document could not be read');
        }
      }
    });
  }

  private getProvider(): AiProvider {
    if (!this.provider) {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');

      if (!apiKey) {
        throw new ServiceUnavailableException('GEMINI_API_KEY is not set');
      }

      this.provider = new GeminiProvider(apiKey, AI_MODEL);
    }

    return this.provider;
  }
}
