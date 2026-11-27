import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
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
import {
  CreatePageDto,
  CreateSectionDto,
  SetPageSectionsDto,
  UpdatePageDto,
  UpdateSectionDto,
} from '@/clients/dto/site-pages.dto';
import { SitePagesService } from '@/clients/services/site-pages.service';
import { WebsiteService } from '@/clients/services/website.service';
import {
  CLIENT_IMAGE_SLOTS,
  ClientImageSlot,
} from '@/clients/website.constants';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { IMAGE_MAX_UPLOAD_BYTES } from '@/storage/storage.constants';
import { User } from '@/users/entities/user.entity';

const IMAGE_BODY = {
  type: 'object',
  properties: {
    file: { type: 'string', format: 'binary' },
    altText: { type: 'string' },
  },
};

const alt = (altText: unknown) =>
  typeof altText === 'string' ? altText.slice(0, 255) : undefined;

/** The white label site of the company of the logged in admin (the dashboard page "Web sajt") */
@Controller('website')
@ApiTags('Website')
@ApiBearerAuth('access-token')
@Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
export class WebsiteController {
  constructor(
    private readonly websiteService: WebsiteService,
    private readonly sitePagesService: SitePagesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'The site of my company: general info, the pages with their SEO and sections, and every section. 404 when the company has no site',
  })
  findOne(@CurrentUser() user: User) {
    return this.websiteService.findOne(user);
  }

  @Patch()
  @ApiOperation({
    summary:
      'Change the general info of the site (name, city, address, phone, Instagram, working hours)',
  })
  update(@Body() dto: UpdateWebsiteDto, @CurrentUser() user: User) {
    return this.websiteService.update(user, dto);
  }

  @Post('publish')
  @ApiOperation({
    summary:
      'Publish the site. Only a complete site can be published (the general info, the logo and everything on the published pages), 400 says what is missing',
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
      'Upload the logo or the picture of the map (optional, shown instead of the Google map until its cookies are accepted). Saved as a WebP, the old one is replaced',
  })
  @ApiParam({ name: 'slot', enum: CLIENT_IMAGE_SLOTS })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: IMAGE_BODY })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_MAX_UPLOAD_BYTES } }),
  )
  setImage(
    @Param('slot', new ParseEnumPipe(CLIENT_IMAGE_SLOTS)) slot: ClientImageSlot,
    @UploadedFile() file: Express.Multer.File,
    @Body('altText') altText: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.websiteService.setImage(user, slot, file, alt(altText));
  }

  @Delete('images/:slot')
  @ApiOperation({ summary: 'Delete the logo or the picture of the map' })
  @ApiParam({ name: 'slot', enum: CLIENT_IMAGE_SLOTS })
  removeImage(
    @Param('slot', new ParseEnumPipe(CLIENT_IMAGE_SLOTS)) slot: ClientImageSlot,
    @CurrentUser() user: User,
  ) {
    return this.websiteService.removeImage(user, slot);
  }

  // ---- pages ----

  @Post('pages')
  @ApiOperation({
    summary:
      'A new page (a draft at the end of the menu), its address is made from the title when it is left out',
  })
  createPage(@Body() dto: CreatePageDto, @CurrentUser() user: User) {
    return this.sitePagesService.createPage(user, dto);
  }

  @Patch('pages/:pageId')
  @ApiOperation({
    summary:
      'Change the title, the address, the status or the SEO texts of a page. The home page and the menu keep their address and stay published',
  })
  updatePage(
    @Param('pageId', ParseIntPipe) pageId: number,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.updatePage(user, pageId, dto);
  }

  @Delete('pages/:pageId')
  @ApiOperation({
    summary:
      'Delete a page, its sections stay. The home page and the menu can not be deleted',
  })
  removePage(
    @Param('pageId', ParseIntPipe) pageId: number,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.removePage(user, pageId);
  }

  @Put('pages/:pageId/sections')
  @ApiOperation({
    summary:
      'All the sections of a page in their order with their visibility, a section left out is taken off the page',
  })
  setPageSections(
    @Param('pageId', ParseIntPipe) pageId: number,
    @Body() dto: SetPageSectionsDto,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.setPageSections(user, pageId, dto);
  }

  @Post('pages/:pageId/sections')
  @ApiOperation({
    summary: 'A new empty section at the end of the page',
  })
  createSection(
    @Param('pageId', ParseIntPipe) pageId: number,
    @Body() dto: CreateSectionDto,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.createSection(user, pageId, dto);
  }

  @Put('pages/:pageId/seo/image')
  @ApiOperation({
    summary: 'Upload the picture shown when the page is shared',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: IMAGE_BODY })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_MAX_UPLOAD_BYTES } }),
  )
  setSeoImage(
    @Param('pageId', ParseIntPipe) pageId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('altText') altText: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.setSeoImage(user, pageId, file, alt(altText));
  }

  @Delete('pages/:pageId/seo/image')
  @ApiOperation({ summary: 'Delete the picture shown when the page is shared' })
  removeSeoImage(
    @Param('pageId', ParseIntPipe) pageId: number,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.removeSeoImage(user, pageId);
  }

  // ---- sections ----

  @Patch('sections/:sectionId')
  @ApiOperation({
    summary:
      'Change the name and the texts of a section (on every page it is on), a section takes only the texts of its type',
  })
  updateSection(
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.updateSection(user, sectionId, dto);
  }

  @Delete('sections/:sectionId')
  @ApiOperation({ summary: 'Delete a section from every page it is on' })
  removeSection(
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.removeSection(user, sectionId);
  }

  @Put('sections/:sectionId/image')
  @ApiOperation({
    summary:
      'Upload the picture of a section (hero, story, info). It is saved as a WebP, the old one is replaced',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: IMAGE_BODY })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_MAX_UPLOAD_BYTES } }),
  )
  setSectionImage(
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('altText') altText: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.setSectionImage(
      user,
      sectionId,
      file,
      alt(altText),
    );
  }

  @Delete('sections/:sectionId/image')
  @ApiOperation({ summary: 'Delete the picture of a section' })
  removeSectionImage(
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @CurrentUser() user: User,
  ) {
    return this.sitePagesService.removeSectionImage(user, sectionId);
  }

  @Get('contacts')
  @ApiOperation({
    summary: 'The messages from the contact form of the site, newest first',
  })
  findContacts(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.websiteService.findContacts(user, query);
  }
}
