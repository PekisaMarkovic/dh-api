import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/auth/decorators';
import { FindOrdersDto } from '@/orders/dto/find-orders.dto';
import { UpdateOrderStatusDto } from '@/orders/dto/update-order-status.dto';
import { OrdersService } from '@/orders/services/orders.service';
import { User } from '@/users/entities/user.entity';

/** The orders from the site of the company (the dashboard page "Porudžbine"), for every employee */
@Controller('orders')
@ApiTags('Orders')
@ApiBearerAuth('access-token')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary:
      'A page of the orders of the company, the newest first, optionally with one status',
  })
  findAll(@CurrentUser() user: User, @Query() query: FindOrdersDto) {
    return this.ordersService.findAll(user, query);
  }

  // before :orderId, so "enabled" is not read as an id
  @Get('enabled')
  @ApiOperation({
    summary:
      'Whether the site of the company lets the visitors order (the menu item "Porudžbine" is shown only then)',
  })
  isEnabled(@CurrentUser() user: User) {
    return this.ordersService.isEnabled(user);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'An order with its drinks' })
  findOne(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.findOne(orderId, user);
  }

  @Patch(':orderId/status')
  @ApiOperation({
    summary:
      'Change the status of an order (in progress, delivered, cancelled with a reason that goes to the buyer)',
  })
  updateStatus(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.updateStatus(orderId, dto, user);
  }
}
