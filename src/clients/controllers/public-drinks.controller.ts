import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/auth/decorators';
import { CurrentClient } from '@/clients/decorators/current-client.decorator';
import { Client } from '@/clients/entities/client.entity';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { PublicDrinksService } from '@/clients/services/public-drinks.service';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

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
  findAll(@CurrentClient() client: Client, @Query() query: PaginationQueryDto) {
    return this.publicDrinksService.findAll(client, query);
  }
}
