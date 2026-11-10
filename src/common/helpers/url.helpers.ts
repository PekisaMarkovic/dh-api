import { ConfigService } from '@nestjs/config';

const LOCAL_DASHBOARD_URL = 'http://localhost:4300';

/**
 * The address of the dashboard, used in the links of the emails and for CORS.
 *
 * - production: APP_DASHBOARD is the one domain of the app and it has to be set,
 *   a link that points to localhost would be useless to the person that gets it
 * - everything else: APP_DASHBOARD if it is set, otherwise localhost:4300
 */
export const getDashboardUrl = (configService: ConfigService): string => {
  const configured = configService.get<string>('APP_DASHBOARD')?.trim();
  const isProduction = configService.get('ENVIROMENT') === 'production';

  if (isProduction) {
    if (!configured || /localhost|127\.0\.0\.1/.test(configured)) {
      throw new Error(
        'APP_DASHBOARD must be the production domain of the dashboard, e.g. https://app.example.com',
      );
    }
  }

  return (configured || LOCAL_DASHBOARD_URL).replace(/\/+$/, '');
};
