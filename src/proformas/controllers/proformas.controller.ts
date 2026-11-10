import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import { User } from '@/users/entities/user.entity';
import { ProformasService } from '@/proformas/services/proformas.service';
import { CreateProformaDto } from '@/proformas/dto/proforma.dto';

@Controller('proformas')
@ApiTags('Proformas')
@ApiBearerAuth('access-token')
export class ProformasController {
  constructor(private readonly proformasService: ProformasService) {}

  @Get()
  @ApiOperation({ summary: 'Proformas of your company, newest first' })
  findAll(@CurrentUser() user: User) {
    return this.proformasService.findAll(user);
  }

  @Get(':proformaId')
  @ApiOperation({ summary: 'A proforma with all its items' })
  findOne(
    @Param('proformaId', ParseIntPipe) proformaId: number,
    @CurrentUser() user: User,
  ) {
    return this.proformasService.findOne(proformaId, user);
  }

  @Get(':proformaId/pdf')
  @ApiOperation({ summary: 'Download the proforma as a PDF' })
  async downloadPdf(
    @Param('proformaId', ParseIntPipe) proformaId: number,
    @CurrentUser() user: User,
  ) {
    const { buffer, filename } = await this.proformasService.createPdf(
      proformaId,
      user,
    );

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post(':proformaId/return')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({
    summary: 'Put the drinks of the proforma back on the stock (only once)',
  })
  returnToStock(
    @Param('proformaId', ParseIntPipe) proformaId: number,
    @CurrentUser() user: User,
  ) {
    return this.proformasService.returnToStock(proformaId, user);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a proforma from drinks of one warehouse',
  })
  create(@Body() dto: CreateProformaDto, @CurrentUser() user: User) {
    return this.proformasService.create(dto, user);
  }
}
