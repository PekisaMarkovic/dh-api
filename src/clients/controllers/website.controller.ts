import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import { UpdateWebsiteDto } from '@/clients/dto/update-website.dto';
import { WebsiteService } from '@/clients/services/website.service';
import {
  WEBSITE_IMAGE_SLOTS,
  WebsiteImageSlot,
} from '@/clients/website.constants';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { IMAGE_MAX_UPLOAD_BYTES } from '@/storage/storage.constants';
import { User } from '@/users/entities/user.entity';

/** The white label site of the company of the logged in admin (the dashboard page "Web sajt") */
@Controller('website')
@ApiTags('Website')
@ApiBearerAuth('access-token')
@Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
export class WebsiteController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get()
  @ApiOperation({
    summary:
      'The site of my company (general info, texts and pictures). 404 when the company has no site',
  })
  findOne(@CurrentUser() user: User) {
    return this.websiteService.findOne(user);
  }

  @Patch()
  @ApiOperation({
    summary:
      'Change the general info and the texts of the sections. An empty text removes it, the site then shows its default text',
  })
  update(@Body() dto: UpdateWebsiteDto, @CurrentUser() user: User) {
    return this.websiteService.update(user, dto);
  }

  @Post('publish')
  @ApiOperation({
    summary:
      'Publish the site. Only a complete site can be published (all texts, the pictures and at least one recommended drink), 400 says what is missing',
  })
  publish(@CurrentUser() user: User) {
    return this.websiteService.publish(user);
  }

  @Post('unpublish')
  @ApiOperation({
    summary: 'Take the site back to a draft, it shows "coming soon" again',
  })
  unpublish(@CurrentUser() user: User) {
    return this.websiteService.unpublish(user);
  }

  @Put('images/:slot')
  @ApiOperation({
    summary:
      'Upload a picture: logo, hero (background), story or promo. It is saved as a WebP, the old one is replaced',
  })
  @ApiParam({ name: 'slot', enum: WEBSITE_IMAGE_SLOTS })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_MAX_UPLOAD_BYTES } }),
  )
  setImage(
    @Param('slot', new ParseEnumPipe(WEBSITE_IMAGE_SLOTS))
    slot: WebsiteImageSlot,
    @UploadedFile() file: Express.Multer.File,
    @Body('altText') altText: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.websiteService.setImage(
      user,
      slot,
      file,
      typeof altText === 'string' ? altText.slice(0, 255) : undefined,
    );
  }

  @Delete('images/:slot')
  @ApiOperation({ summary: 'Delete a picture of the site' })
  @ApiParam({ name: 'slot', enum: WEBSITE_IMAGE_SLOTS })
  removeImage(
    @Param('slot', new ParseEnumPipe(WEBSITE_IMAGE_SLOTS))
    slot: WebsiteImageSlot,
    @CurrentUser() user: User,
  ) {
    return this.websiteService.removeImage(user, slot);
  }

  @Get('contacts')
  @ApiOperation({
    summary: 'The messages from the contact form of the site, newest first',
  })
  findContacts(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.websiteService.findContacts(user, query);
  }
}
