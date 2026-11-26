import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/auth/decorators';
import { CurrentClient } from '@/clients/decorators/current-client.decorator';
import { Client } from '@/clients/entities/client.entity';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { PublicDrinksQueryDto } from '@/clients/dto/public-drinks-query.dto';
import { PublicDrinksService } from '@/clients/services/public-drinks.service';

/** Routes for the white label sites, no login: the site is known by the GUID of its client */
@Controller('public/drinks')
@ApiTags('Public')
@ApiHeader({
  name: 'X-Access-Key',
  description: 'The GUID of the client (clients.client_id)',
  required: true,
})
@Public()
@UseGuards(ClientAccessGuard)
export class PublicDrinksController {
  constructor(private readonly publicDrinksService: PublicDrinksService) {}

  @Get()
  @ApiOperation({
    summary:
      'A page of the drinks of the company of the client, sorted by name (the menu of the site)',
  })
  findAll(
    @CurrentClient() client: Client,
    @Query() query: PublicDrinksQueryDto,
  ) {
    return this.publicDrinksService.findAll(client, query);
  }

  @Get('categories')
  @ApiOperation({
    summary:
      'The categories of the company of the client that have drinks, sorted by name, with drinksCount (the filter of the menu)',
  })
  categories(@CurrentClient() client: Client) {
    return this.publicDrinksService.categories(client);
  }
}
