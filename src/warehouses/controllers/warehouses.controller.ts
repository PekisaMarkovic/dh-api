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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { parseOptionalInt } from '@/common/helpers';
import { CurrentUser, Roles } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import { User } from '@/users/entities/user.entity';
import { WarehousesService } from '@/warehouses/services/warehouses.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from '@/warehouses/dto/warehouse.dto';

@Controller('warehouses')
@ApiTags('Warehouses')
@ApiBearerAuth('access-token')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @ApiOperation({ summary: 'Get warehouses, optionally of one company' })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  findAll(
    @CurrentUser() user: User,
    @Query('companyId') companyIdRaw?: string,
  ) {
    return this.warehousesService.findAll(
      user,
      parseOptionalInt(companyIdRaw, 'companyId'),
    );
  }

  @Get(':warehouseId')
  @ApiOperation({ summary: 'Get a warehouse with its drinks' })
  findOne(
    @Param('warehouseId', ParseIntPipe) warehouseId: number,
    @CurrentUser() user: User,
  ) {
    return this.warehousesService.findOne(warehouseId, user);
  }

  @Post()
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Create a warehouse in a company' })
  create(@Body() dto: CreateWarehouseDto, @CurrentUser() user: User) {
    return this.warehousesService.create(dto, user);
  }

  @Patch(':warehouseId')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Update a warehouse' })
  update(
    @Param('warehouseId', ParseIntPipe) warehouseId: number,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: User,
  ) {
    return this.warehousesService.update(warehouseId, dto, user);
  }

  @Delete(':warehouseId')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({
    summary: 'Soft delete a warehouse, only allowed when it has no drinks',
  })
  remove(
    @Param('warehouseId', ParseIntPipe) warehouseId: number,
    @CurrentUser() user: User,
  ) {
    return this.warehousesService.remove(warehouseId, user);
  }
}
