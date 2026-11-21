import { ConfigService } from '@nestjs/config';
import { getDashboardUrl } from '@/common/helpers/url.helpers';

describe('getDashboardUrl', () => {
  const config = (values: Record<string, string | undefined>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  it('should use localhost when nothing is set and it is not production', () => {
    expect(getDashboardUrl(config({}))).toBe('http://localhost:4300');
  });

  it('should use APP_DASHBOARD when it is set', () => {
    expect(
      getDashboardUrl(
        config({ APP_DASHBOARD: 'https://staging.drinkhouse.rs' }),
      ),
    ).toBe('https://staging.drinkhouse.rs');
  });

  it('should remove the slashes at the end and the spaces', () => {
    expect(
      getDashboardUrl(
        config({ APP_DASHBOARD: ' https://app.drinkhouse.rs// ' }),
      ),
    ).toBe('https://app.drinkhouse.rs');
  });

  it('should use the domain in production', () => {
    expect(
      getDashboardUrl(
        config({
          ENVIROMENT: 'production',
          APP_DASHBOARD: 'https://app.drinkhouse.rs',
        }),
      ),
    ).toBe('https://app.drinkhouse.rs');
  });

  it('should refuse to start in production without the domain, a link to localhost is of no use', () => {
    expect(() => getDashboardUrl(config({ ENVIROMENT: 'production' }))).toThrow(
      'APP_DASHBOARD must be the production domain',
    );
  });

  it.each(['http://localhost:4300', 'http://127.0.0.1:4300'])(
    'should refuse %s in production',
    (APP_DASHBOARD) => {
      expect(() =>
        getDashboardUrl(config({ ENVIROMENT: 'production', APP_DASHBOARD })),
      ).toThrow('APP_DASHBOARD must be the production domain');
    },
  );
});
