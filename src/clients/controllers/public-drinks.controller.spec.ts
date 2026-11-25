import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PublicDrinksController } from '@/clients/controllers/public-drinks.controller';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { PublicDrinksService } from '@/clients/services/public-drinks.service';
import { isPublic } from '@/common/testing/controller.helpers';
import { Client } from '@/clients/entities/client.entity';

describe('PublicDrinksController', () => {
  const service = { findAll: jest.fn().mockReturnValue('page') };
  const controller = new PublicDrinksController(
    service as unknown as PublicDrinksService,
  );

  it('should skip the login (JWT) but ask for the access key of a client', () => {
    expect(isPublic(PublicDrinksController)).toBe(true);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PublicDrinksController),
    ).toContain(ClientAccessGuard);
  });

  it('should list the drinks of the client', () => {
    const client = { companyId: 1 } as Client;
    const query = { page: 2, limit: 10 };

    expect(controller.findAll(client, query)).toBe(
      service.findAll(client, query),
    );
    expect(service.findAll).toHaveBeenCalledWith(client, query);
  });
});
