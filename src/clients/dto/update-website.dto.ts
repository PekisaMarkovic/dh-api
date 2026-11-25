import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_FEATURED_DRINKS } from '@/clients/website.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * A text of the site. It is optional (a form of one tab sends only its own fields), but when it is sent it can not be empty:
 * every text of the site is needed before the site can be published.
 */
const text = (max: number) => {
  return (target: object, key: string) => {
    ApiPropertyOptional({ maxLength: max })(target, key);
    Transform(trim)(target, key);
    IsOptional()(target, key);
    IsString()(target, key);
    IsNotEmpty()(target, key);
    MaxLength(max)(target, key);
  };
};

export class HeroSectionDto {
  @text(150) title?: string;
  @text(150) subtitle?: string;
  @text(500) text?: string;
  @text(60) buttonText?: string;
}

export class FeaturedSectionDto {
  @text(150) title?: string;
  @text(60) buttonText?: string;

  @ApiPropertyOptional({
    type: [Number],
    description: `The picked drinks (at least one, at most ${MAX_FEATURED_DRINKS}), in the order they are shown`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_FEATURED_DRINKS)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  drinkIds?: number[];
}

export class StorySectionDto {
  @text(150) title?: string;
  @text(1000) paragraph1?: string;
  @text(1000) paragraph2?: string;
  @text(60) buttonText?: string;
}

export class PromoSectionDto {
  @text(150) title?: string;
  @text(1000) text?: string;
  @text(60) buttonText?: string;
}

export class UpdateWebsiteDto {
  // ---- general info ----
  @ApiPropertyOptional({ example: 'Drink House' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @text(100) city?: string;
  @text(150) address?: string;
  // digits, +, -, spaces, brackets
  @text(50)
  @Matches(/^[0-9+\-()\s/.]{6,50}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;
  // one day per line (a new line is kept)
  @text(500) workingHours?: string;

  @ApiPropertyOptional({ example: 'https://www.instagram.com/drinkhouse' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^https?:\/\/\S+$/, {
    message: 'instagram must be an address (https://...)',
  })
  instagram?: string;

  // ---- sections ----
  @ApiPropertyOptional({ type: () => HeroSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HeroSectionDto)
  hero?: HeroSectionDto;

  @ApiPropertyOptional({ type: () => FeaturedSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FeaturedSectionDto)
  featured?: FeaturedSectionDto;

  @ApiPropertyOptional({ type: () => StorySectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StorySectionDto)
  story?: StorySectionDto;

  @ApiPropertyOptional({ type: () => PromoSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PromoSectionDto)
  promo?: PromoSectionDto;
}
