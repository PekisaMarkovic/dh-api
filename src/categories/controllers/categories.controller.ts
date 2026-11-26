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
import { CurrentUser, Roles } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '@/categories/dto/category.dto';
import { CategoriesService } from '@/categories/services/categories.service';
import { parseOptionalInt } from '@/common/helpers';
import { User } from '@/users/entities/user.entity';

@Controller('categories')
@ApiTags('Categories')
@ApiBearerAuth('access-token')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary:
      'All the categories of a company sorted by name, with the number of their drinks (drinksCount)',
  })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  findAll(
    @CurrentUser() user: User,
    @Query('companyId') companyIdRaw?: string,
  ) {
    return this.categoriesService.findAll(
      user,
      parseOptionalInt(companyIdRaw, 'companyId'),
    );
  }

  @Post()
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Create a category of drinks' })
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: User) {
    return this.categoriesService.create(dto, user);
  }

  @Patch(':categoryId')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Rename a category' })
  update(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: User,
  ) {
    return this.categoriesService.update(categoryId, dto, user);
  }

  @Delete(':categoryId')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({
    summary: 'Soft delete a category, its drinks stay but are no longer in it',
  })
  remove(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @CurrentUser() user: User,
  ) {
    return this.categoriesService.remove(categoryId, user);
  }
}
