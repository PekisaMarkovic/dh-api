import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  /** The client with this id, null when the text is not a GUID or the client does not exist (or was deleted) */
  async findActive(clientId: string): Promise<Client | null> {
    // a text that is not a GUID would make Postgres fail, it can only be a wrong key
    if (!GUID.test(clientId)) {
      return null;
    }

    return this.clientRepository.findOne({ where: { clientId } });
  }
}
