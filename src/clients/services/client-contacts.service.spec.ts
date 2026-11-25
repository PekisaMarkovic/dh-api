import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { ClientContactedBy } from '@/clients/entities/client-contacted-by.entity';
import { ClientContactsService } from '@/clients/services/client-contacts.service';

describe('ClientContactsService', () => {
  const client = { clientId: 'abc', companyId: 1 } as Client;
  let repository: { create: jest.Mock; save: jest.Mock };
  let service: ClientContactsService;

  beforeEach(() => {
    repository = {
      create: jest.fn((e: Partial<ClientContactedBy>) => e),
      save: jest.fn((e: Partial<ClientContactedBy>) =>
        Promise.resolve({ contactId: 7, ...e }),
      ),
    };
    service = new ClientContactsService(
      repository as unknown as Repository<ClientContactedBy>,
    );
  });

  it('should save the message for the client the form belongs to', async () => {
    const result = await service.create(client, {
      name: 'Petar',
      phone: '064 123 456',
      email: 'p@example.com',
      message: 'Treba mi 2 kutije piva',
    });

    expect(repository.create).toHaveBeenCalledWith({
      clientId: 'abc',
      name: 'Petar',
      phone: '064 123 456',
      email: 'p@example.com',
      message: 'Treba mi 2 kutije piva',
    });
    expect(result).toEqual({ contactId: 7 });
  });

  it('should save an empty email and message as null', async () => {
    await service.create(client, { name: 'Petar', phone: '064 123 456' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: null, message: null }),
    );
  });
});
