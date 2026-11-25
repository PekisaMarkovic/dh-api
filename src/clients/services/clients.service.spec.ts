import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { ClientsService } from '@/clients/services/clients.service';

describe('ClientsService', () => {
  const guid = '9831b56b-54d4-4c19-97ba-302d483a62d8';
  let repository: { findOne: jest.Mock };
  let service: ClientsService;

  beforeEach(() => {
    repository = { findOne: jest.fn() };
    service = new ClientsService(repository as unknown as Repository<Client>);
  });

  it('should find the client by its GUID', async () => {
    repository.findOne.mockResolvedValue({ clientId: guid });

    await expect(service.findActive(guid)).resolves.toEqual({ clientId: guid });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { clientId: guid },
    });
  });

  it('should not ask the database for a text that is not a GUID', async () => {
    await expect(service.findActive('1; drop table')).resolves.toBeNull();
    expect(repository.findOne).not.toHaveBeenCalled();
  });
});
