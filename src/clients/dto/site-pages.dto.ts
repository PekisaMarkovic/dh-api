import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { text } from '@/clients/dto/update-website.dto';
import { ClientStatus } from '@/clients/client-status.enum';
import { MAX_FEATURED_DRINKS, SLUG_PATTERN } from '@/clients/website.constants';
import { SectionType } from '@/clients/website.types';

const slug = (target: object, key: string) => {
  ApiPropertyOptional({
    example: 'o-nama',
    description: 'lowercase letters, digits and dashes',
  })(target, key);
  IsOptional()(target, key);
  Matches(SLUG_PATTERN, {
    message: 'slug can have only lowercase letters, digits and dashes',
  })(target, key);
};

export class CreatePageDto {
  @text(100)
  @IsDefined()
  title: string;

  // made from the title when it is left out
  @slug slug?: string;
}

/** The texts Google shows: the title (about 60 characters) and the description (about 155) */
export class PageSeoDto {
  @text(70) title?: string;
  @text(160) description?: string;
}

export class UpdatePageDto {
  @text(100) title?: string;
  @slug slug?: string;

  @ApiPropertyOptional({ enum: [ClientStatus.DRAFT, ClientStatus.PUBLISHED] })
  @IsOptional()
  @IsIn([ClientStatus.DRAFT, ClientStatus.PUBLISHED])
  status?: ClientStatus;

  @ApiPropertyOptional({ type: () => PageSeoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PageSeoDto)
  seo?: PageSeoDto;
}

export class PageSectionItemDto {
  @ApiProperty()
  @IsInt()
  sectionId: number;

  @ApiProperty()
  @IsBoolean()
  isVisible: boolean;
}

/** All the sections of a page in their order, they replace the old ones (a section left out is taken off the page) */
export class SetPageSectionsDto {
  @ApiProperty({ type: [PageSectionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageSectionItemDto)
  sections: PageSectionItemDto[];
}

export class CreateSectionDto {
  @ApiProperty({ enum: SectionType })
  @IsEnum(SectionType)
  type: SectionType;

  // the name of the type when it is left out
  @text(100) name?: string;
}

/** The name and the texts of a section, a section takes only the texts of its type */
export class UpdateSectionDto {
  @text(100) name?: string;
  @text(150) title?: string;
  @text(150) subtitle?: string;
  @text(1000) text?: string;
  @text(1000) paragraph1?: string;
  @text(1000) paragraph2?: string;
  @text(60) buttonText?: string;

  @ApiPropertyOptional({
    type: [Number],
    description: `Only the recommended drinks: an even number (2, 4, ... at most ${MAX_FEATURED_DRINKS}), in the order they are shown`,
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
