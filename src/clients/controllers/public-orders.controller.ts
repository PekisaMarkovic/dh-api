import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@/auth/decorators';
import { CurrentClient } from '@/clients/decorators/current-client.decorator';
import { Client } from '@/clients/entities/client.entity';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { CreateOrderDto } from '@/orders/dto/create-order.dto';
import { OrdersService } from '@/orders/services/orders.service';

/** Orders from a white label site, no login: the site is known by the GUID of its client */
@Controller('public/orders')
@ApiTags('Public')
@ApiHeader({
  name: 'X-Access-Key',
  description: 'The GUID of the client (clients.client_id)',
  required: true,
})
@Public()
@UseGuards(ClientAccessGuard, ThrottlerGuard)
export class PublicOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // anybody can call it, so it is limited: 5 orders per minute from one address
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Send an order from the site (only when the site allows ordering), the employees and the buyer get an email',
  })
  create(@CurrentClient() client: Client, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(client, dto);
  }
}
