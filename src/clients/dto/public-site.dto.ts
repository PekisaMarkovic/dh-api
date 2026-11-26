import { ApiProperty } from '@nestjs/swagger';
import {
  PublicDrinkDto,
  PublicDrinkImageDto,
} from '@/clients/dto/public-drink.dto';
import { ClientStatus } from '@/clients/client-status.enum';
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

class PublicImageSection {
  @ApiProperty({ type: () => PublicDrinkImageDto, nullable: true })
  image: PublicDrinkImageDto | null;
}

class PublicHero extends PublicImageSection {
  @ApiProperty({ nullable: true, type: String }) title: string | null;
  @ApiProperty({ nullable: true, type: String }) subtitle: string | null;
  @ApiProperty({ nullable: true, type: String }) text: string | null;
  @ApiProperty({ nullable: true, type: String }) buttonText: string | null;
}

class PublicFeatured {
  @ApiProperty({ nullable: true, type: String }) title: string | null;
  @ApiProperty({ nullable: true, type: String }) buttonText: string | null;
  @ApiProperty({ type: () => [PublicDrinkDto] }) drinks: PublicDrinkDto[];
}

class PublicStory extends PublicImageSection {
  @ApiProperty({ nullable: true, type: String }) title: string | null;
  @ApiProperty({ nullable: true, type: String }) paragraph1: string | null;
  @ApiProperty({ nullable: true, type: String }) paragraph2: string | null;
  @ApiProperty({ nullable: true, type: String }) buttonText: string | null;
}

class PublicPromo extends PublicImageSection {
  @ApiProperty({ nullable: true, type: String }) title: string | null;
  @ApiProperty({ nullable: true, type: String }) text: string | null;
  @ApiProperty({ nullable: true, type: String }) buttonText: string | null;
}

class PublicSeo {
  @ApiProperty({ nullable: true, type: String }) title: string | null;
  @ApiProperty({ nullable: true, type: String }) description: string | null;
  @ApiProperty({ nullable: true, type: String }) menuTitle: string | null;
  @ApiProperty({ nullable: true, type: String }) menuDescription: string | null;
  @ApiProperty({
    type: () => PublicDrinkImageDto,
    nullable: true,
    description: 'The picture shown when the site is shared',
  })
  image: PublicDrinkImageDto | null;
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
  @ApiProperty({ type: () => PublicHero }) hero: PublicHero;
  @ApiProperty({ type: () => PublicFeatured }) featured: PublicFeatured;
  @ApiProperty({ type: () => PublicStory }) story: PublicStory;
  @ApiProperty({ type: () => PublicPromo }) promo: PublicPromo;
  @ApiProperty({ type: () => PublicSeo }) seo: PublicSeo;
}
