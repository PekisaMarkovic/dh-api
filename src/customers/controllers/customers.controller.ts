import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { CurrentUser, Roles } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import { User } from '@/users/entities/user.entity';
import { CustomersService } from '@/customers/services/customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
} from '@/customers/dto/customer.dto';

@Controller('customers')
@ApiTags('Customers')
@ApiBearerAuth('access-token')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({
    summary: 'A page of customers sorted by name, optionally searched by name',
  })
  findAll(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.customersService.findAll(user, query);
  }

  @Get('options')
  @ApiOperation({
    summary: 'Id and name of every customer, for a select (not paginated)',
  })
  findOptions(@CurrentUser() user: User) {
    return this.customersService.findOptions(user);
  }

  @Get(':customerId')
  @ApiOperation({ summary: 'Get a customer' })
  findOne(
    @Param('customerId', ParseIntPipe) customerId: number,
    @CurrentUser() user: User,
  ) {
    return this.customersService.findOne(customerId, user);
  }

  @Post()
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Create a customer' })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: User) {
    return this.customersService.create(dto, user);
  }

  @Patch(':customerId')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Rename a customer' })
  update(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: User,
  ) {
    return this.customersService.update(customerId, dto, user);
  }

  @Delete(':customerId')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Soft delete a customer' })
  remove(
    @Param('customerId', ParseIntPipe) customerId: number,
    @CurrentUser() user: User,
  ) {
    return this.customersService.remove(customerId, user);
  }
}
