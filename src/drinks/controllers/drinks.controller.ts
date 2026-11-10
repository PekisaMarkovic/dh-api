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
import { DrinksService } from '@/drinks/services/drinks.service';
import { CreateDrinkDto, UpdateDrinkDto } from '@/drinks/dto/drink.dto';

@Controller('drinks')
@ApiTags('Drinks')
@ApiBearerAuth('access-token')
export class DrinksController {
  constructor(private readonly drinksService: DrinksService) {}

  @Get()
  @ApiOperation({ summary: 'Get drinks, optionally of one warehouse' })
  @ApiQuery({ name: 'warehouseId', required: false, type: Number })
  findAll(
    @CurrentUser() user: User,
    @Query('warehouseId') warehouseIdRaw?: string,
  ) {
    return this.drinksService.findAll(
      user,
      parseOptionalInt(warehouseIdRaw, 'warehouseId'),
    );
  }

  @Get(':drinkId')
  @ApiOperation({ summary: 'Get a drink' })
  findOne(
    @Param('drinkId', ParseIntPipe) drinkId: number,
    @CurrentUser() user: User,
  ) {
    return this.drinksService.findOne(drinkId, user);
  }

  @Post()
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Create a drink in a warehouse' })
  create(@Body() dto: CreateDrinkDto, @CurrentUser() user: User) {
    return this.drinksService.create(dto, user);
  }

  @Patch(':drinkId')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Update a drink (name, price, quantity)' })
  update(
    @Param('drinkId', ParseIntPipe) drinkId: number,
    @Body() dto: UpdateDrinkDto,
    @CurrentUser() user: User,
  ) {
    return this.drinksService.update(drinkId, dto, user);
  }

  @Delete(':drinkId')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Soft delete a drink' })
  remove(
    @Param('drinkId', ParseIntPipe) drinkId: number,
    @CurrentUser() user: User,
  ) {
    return this.drinksService.remove(drinkId, user);
  }
}
