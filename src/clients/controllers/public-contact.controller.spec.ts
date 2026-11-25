import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Client } from '@/clients/entities/client.entity';
import { PublicContactController } from '@/clients/controllers/public-contact.controller';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { ClientContactsService } from '@/clients/services/client-contacts.service';
import { isPublic } from '@/common/testing/controller.helpers';

describe('PublicContactController', () => {
  const service = { create: jest.fn().mockReturnValue('saved') };
  const controller = new PublicContactController(
    service as unknown as ClientContactsService,
  );

  it('should skip the login, ask for the access key and limit the calls', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      PublicContactController,
    );

    expect(isPublic(PublicContactController)).toBe(true);
    expect(guards).toEqual([ClientAccessGuard, ThrottlerGuard]);
  });

  it('should save the message of the client', () => {
    const client = { clientId: 'abc' } as Client;
    const dto = { name: 'Petar', phone: '064123456' };

    expect(controller.create(client, dto)).toBe('saved');
    expect(service.create).toHaveBeenCalledWith(client, dto);
  });
});
