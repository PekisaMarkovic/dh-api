import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SiteRevalidationService } from '@/clients/services/site-revalidation.service';

const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('SiteRevalidationService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('should call every site with the shared secret', async () => {
    const service = new SiteRevalidationService(
      config({
        REVALIDATE_SECRET: ' s3cret ',
        APP_CLIENT: 'https://a.rs, https://b.rs/',
      }),
    );

    await service.notify();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://a.rs/api/revalidate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'x-revalidate-secret': 's3cret' },
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://b.rs/api/revalidate',
      expect.anything(),
    );
  });

  it('should do nothing without a secret', async () => {
    await new SiteRevalidationService(config({})).notify();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should never fail when a site does not answer', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const service = new SiteRevalidationService(
      config({ REVALIDATE_SECRET: 'x' }),
    );

    await expect(service.notify()).resolves.toBeUndefined();
  });

  it('should not fail when a site refuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const service = new SiteRevalidationService(
      config({ REVALIDATE_SECRET: 'x' }),
    );

    await expect(service.notify()).resolves.toBeUndefined();
  });
});
