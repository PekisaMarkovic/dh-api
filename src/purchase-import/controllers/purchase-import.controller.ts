import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '@/common/dto';
import { CurrentUser, Roles } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import { User } from '@/users/entities/user.entity';
import { PurchaseImportService } from '@/purchase-import/services/purchase-import.service';
import {
  ApplyPurchaseDto,
  ParsePurchaseDto,
} from '@/purchase-import/dto/purchase-import.dto';

@Controller('purchase-import')
@ApiTags('Purchase import')
@ApiBearerAuth('access-token')
@Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
export class PurchaseImportController {
  constructor(private readonly purchaseImportService: PurchaseImportService) {}

  @Post('parse')
  @ApiOperation({
    summary: 'Read drinks and quantities from an image or a PDF, saves nothing',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        warehouseId: { type: 'integer' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  parse(
    @Body() dto: ParsePurchaseDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.purchaseImportService.parse(dto.warehouseId, file, user);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Add the checked quantities to the stock' })
  apply(@Body() dto: ApplyPurchaseDto, @CurrentUser() user: User) {
    return this.purchaseImportService.apply(dto, user);
  }

  @Get()
  @ApiOperation({
    summary:
      'A page of the uploaded documents, newest first, searched by title or file name',
  })
  findAll(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.purchaseImportService.findAll(user, query);
  }

  @Get(':purchaseImportId')
  @ApiOperation({
    summary:
      'One uploaded document with the lines the AI read and what was added',
  })
  findOne(
    @Param('purchaseImportId', ParseIntPipe) purchaseImportId: number,
    @CurrentUser() user: User,
  ) {
    return this.purchaseImportService.findOne(purchaseImportId, user);
  }

  @Delete(':purchaseImportId')
  @ApiOperation({
    summary:
      'Remove a document from the history, the stock that was already added stays',
  })
  remove(
    @Param('purchaseImportId', ParseIntPipe) purchaseImportId: number,
    @CurrentUser() user: User,
  ) {
    return this.purchaseImportService.remove(purchaseImportId, user);
  }
}
