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
import { CompaniesService } from '@/companies/services/companies.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
} from '@/companies/dto/company.dto';

@Controller('companies')
@ApiTags('Companies')
@ApiBearerAuth('access-token')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all companies' })
  findAll(@CurrentUser() user: User) {
    return this.companiesService.findAll(user);
  }

  @Get(':companyId')
  @ApiOperation({ summary: 'Get a company with its warehouses' })
  findOne(
    @Param('companyId', ParseIntPipe) companyId: number,
    @CurrentUser() user: User,
  ) {
    this.companiesService.assertCanAccess(user, companyId);

    return this.companiesService.findOne(companyId);
  }

  @Get(':companyId/users')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({
    summary:
      'A page of the users that belong to the company, searched by name or email',
  })
  findUsers(
    @Param('companyId', ParseIntPipe) companyId: number,
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ) {
    this.companiesService.assertCanAccess(user, companyId);

    return this.companiesService.findUsersPage(companyId, query);
  }

  @Post()
  @Roles(ClientRoleEnums.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a company' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':companyId')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Update a company' })
  update(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: User,
  ) {
    this.companiesService.assertCanAccess(user, companyId);

    return this.companiesService.update(companyId, dto);
  }

  @Delete(':companyId')
  @Roles(ClientRoleEnums.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Soft delete a company with its warehouses and drinks',
  })
  remove(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.companiesService.remove(companyId);
  }
}
