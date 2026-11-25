import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@/auth/decorators';
import { CurrentClient } from '@/clients/decorators/current-client.decorator';
import { CreateContactDto } from '@/clients/dto/create-contact.dto';
import { Client } from '@/clients/entities/client.entity';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { ClientContactsService } from '@/clients/services/client-contacts.service';

/** The contact form of a white label site, no login: the site is known by the GUID of its client */
@Controller('public/contact')
@ApiTags('Public')
@ApiHeader({
  name: 'X-Access-Key',
  description: 'The GUID of the client (clients.client_id)',
  required: true,
})
@Public()
@UseGuards(ClientAccessGuard, ThrottlerGuard)
export class PublicContactController {
  constructor(private readonly contactsService: ClientContactsService) {}

  // anybody can call it, so it is limited: 5 messages per minute from one address
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Save a message from the contact form of the site' })
  create(@CurrentClient() client: Client, @Body() dto: CreateContactDto) {
    return this.contactsService.create(client, dto);
  }
}
