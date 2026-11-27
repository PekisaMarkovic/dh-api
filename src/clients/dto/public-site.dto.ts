import { ApiProperty } from '@nestjs/swagger';
import {
  PublicDrinkDto,
  PublicDrinkImageDto,
} from '@/clients/dto/public-drink.dto';
import { ClientStatus } from '@/clients/client-status.enum';
import { SectionType } from '@/clients/website.types';
import { Image } from '@/storage/entities/image.entity';

export const toPublicImage = (
  image: Image | null | undefined,
): PublicDrinkImageDto | null =>
  image
    ? {
        url: image.url,
        altText: image.altText,
        width: image.width,
        height: image.height,
      }
    : null;

/** A section of a page, a text that is null is not of its type or is not filled in (the site leaves it out) */
export class PublicSectionDto {
  @ApiProperty() sectionId: number;
  @ApiProperty({ enum: SectionType }) type: SectionType;
  @ApiProperty({ nullable: true, type: String }) title: string | null;
  @ApiProperty({ nullable: true, type: String }) subtitle: string | null;
  @ApiProperty({ nullable: true, type: String }) text: string | null;
  @ApiProperty({ nullable: true, type: String }) paragraph1: string | null;
  @ApiProperty({ nullable: true, type: String }) paragraph2: string | null;
  @ApiProperty({ nullable: true, type: String }) buttonText: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Only a text section: sanitized HTML (p, h2-h4, strong, em, u, s, lists, blockquote, links)',
  })
  html: string | null;
  @ApiProperty({ type: () => PublicDrinkImageDto, nullable: true })
  image: PublicDrinkImageDto | null;
  @ApiProperty({
    type: () => [PublicDrinkDto],
    description: 'Only the recommended drinks section has drinks',
  })
  drinks: PublicDrinkDto[];
}

class PublicSeoDto {
  @ApiProperty({ nullable: true, type: String }) title: string | null;
  @ApiProperty({ nullable: true, type: String }) description: string | null;
  @ApiProperty({
    type: () => PublicDrinkImageDto,
    nullable: true,
    description: 'The picture shown when the page is shared',
  })
  image: PublicDrinkImageDto | null;
}

/** A published page, its shown sections in order */
export class PublicPageDto {
  @ApiProperty() title: string;
  @ApiProperty({ description: 'The address, empty for the home page' })
  slug: string;
  @ApiProperty({ description: 'In the main menu, else in the footer' })
  isInMenu: boolean;
  @ApiProperty({ type: () => PublicSeoDto }) seo: PublicSeoDto;
  @ApiProperty({ type: () => [PublicSectionDto] })
  sections: PublicSectionDto[];
}

/** Everything a white label site shows, a text that is null means the site uses its own default text */
export class PublicSiteDto {
  @ApiProperty({
    enum: ClientStatus,
    description: 'a draft site shows a "coming soon" page',
  })
  status: ClientStatus;
  @ApiProperty({ description: 'True when the visitors can order drinks' })
  isOrderingAllowed: boolean;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String }) city: string | null;
  @ApiProperty({ nullable: true, type: String }) address: string | null;
  @ApiProperty({ nullable: true, type: String }) phone: string | null;
  @ApiProperty({ nullable: true, type: String }) instagram: string | null;
  @ApiProperty({ nullable: true, type: String }) workingHours: string | null;
  @ApiProperty({ type: () => PublicDrinkImageDto, nullable: true })
  logo: PublicDrinkImageDto | null;
  @ApiProperty({
    type: () => PublicDrinkImageDto,
    nullable: true,
    description:
      'A picture of the map, shown instead of the Google map until its cookies are accepted. Null: the site draws its own',
  })
  mapImage: PublicDrinkImageDto | null;
  @ApiProperty({
    type: () => [PublicPageDto],
    description: 'The published pages in the order of the menu',
  })
  pages: PublicPageDto[];
}
