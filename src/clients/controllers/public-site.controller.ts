import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/auth/decorators';
import { CurrentClient } from '@/clients/decorators/current-client.decorator';
import { PublicSiteDto } from '@/clients/dto/public-site.dto';
import { Client } from '@/clients/entities/client.entity';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { PublicSiteService } from '@/clients/services/public-site.service';

/** The content of a white label site (texts, pictures, contact data), no login: the site is known by the GUID of its client */
@Controller('public/site')
@ApiTags('Public')
@ApiHeader({
  name: 'X-Access-Key',
  description: 'The GUID of the client (clients.client_id)',
  required: true,
})
@Public()
@UseGuards(ClientAccessGuard)
export class PublicSiteController {
  constructor(private readonly publicSiteService: PublicSiteService) {}

  @Get()
  @ApiOperation({
    summary:
      'Everything the site shows: general info, the sections with their pictures and the recommended drinks',
  })
  find(@CurrentClient() client: Client): Promise<PublicSiteDto> {
    return this.publicSiteService.find(client);
  }
}
