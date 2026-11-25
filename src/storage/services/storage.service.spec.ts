import { ConfigService } from '@nestjs/config';
import { StorageService } from '@/storage/services/storage.service';

const service = (env: Record<string, string>) =>
  new StorageService({ get: (key: string) => env[key] } as ConfigService);

describe('StorageService', () => {
  it('should use the production folder only in production', () => {
    expect(service({ ENVIROMENT: 'production' }).rootFolder).toBe('production');
    expect(service({ ENVIROMENT: 'local' }).rootFolder).toBe('local');
    expect(service({}).rootFolder).toBe('local');
  });

  it('should build the folder company-[name]-[id]/drinks/[drinkId]', () => {
    expect(
      service({ ENVIROMENT: 'local' }).drinkFolder(
        { companyId: 3, name: 'KNEZ Bar Šabac' },
        12,
      ),
    ).toBe('local/company-knez-bar-sabac-3/drinks/12');
  });

  it('should build the public url and return null without a key', () => {
    const s = service({ R2_PUBLIC_URL: 'https://pub.r2.dev/' });

    expect(s.publicUrl('local/a.webp')).toBe('https://pub.r2.dev/local/a.webp');
    expect(s.publicUrl(null)).toBeNull();
  });
});
