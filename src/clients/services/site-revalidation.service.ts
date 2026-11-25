import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getClientUrls } from '@/common/helpers';

/**
 * The white label sites keep what they show in a cache for a few minutes. After the admin changes something
 * this tells every site (APP_CLIENT) to drop that cache, so the change is visible right away.
 * It never fails the request of the admin: a site that does not answer just shows the change a bit later.
 */
@Injectable()
export class SiteRevalidationService {
  private readonly logger = new Logger(SiteRevalidationService.name);

  constructor(private readonly configService: ConfigService) {}

  async notify(): Promise<void> {
    const secret = this.configService.get<string>('REVALIDATE_SECRET')?.trim();

    // without the shared secret the sites would refuse the call anyway
    if (!secret) {
      return;
    }

    await Promise.all(
      getClientUrls(this.configService).map(async (url) => {
        try {
          const response = await fetch(`${url}/api/revalidate`, {
            method: 'POST',
            headers: { 'x-revalidate-secret': secret },
            signal: AbortSignal.timeout(3000),
          });

          if (!response.ok) {
            this.logger.warn(
              `${url} answered ${response.status} to revalidate`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `${url} could not be told to revalidate: ${(error as Error).message}`,
          );
        }
      }),
    );
  }
}
