import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PublicSiteController } from '@/clients/controllers/public-site.controller';
import { Client } from '@/clients/entities/client.entity';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { PublicSiteService } from '@/clients/services/public-site.service';
import { isPublic } from '@/common/testing/controller.helpers';

describe('PublicSiteController', () => {
  const service = { find: jest.fn().mockReturnValue('site') };
  const controller = new PublicSiteController(
    service as unknown as PublicSiteService,
  );

  it('should skip the login but ask for the access key of a client', () => {
    expect(isPublic(PublicSiteController)).toBe(true);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PublicSiteController),
    ).toContain(ClientAccessGuard);
  });

  it('should return the site of the client', () => {
    const client = { clientId: 'abc' } as Client;

    expect(controller.find(client)).toBe('site');
    expect(service.find).toHaveBeenCalledWith(client);
  });
});
