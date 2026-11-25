import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { ClientContactedBy } from '@/clients/entities/client-contacted-by.entity';
import { CreateContactDto } from '@/clients/dto/create-contact.dto';

@Injectable()
export class ClientContactsService {
  constructor(
    @InjectRepository(ClientContactedBy)
    private readonly contactRepository: Repository<ClientContactedBy>,
  ) {}

  /** Saves a message from the contact form of the site of the client */
  async create(client: Client, dto: CreateContactDto) {
    const contact = await this.contactRepository.save(
      this.contactRepository.create({
        clientId: client.clientId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
        message: dto.message ?? null,
      }),
    );

    return { contactId: contact.contactId };
  }
}
