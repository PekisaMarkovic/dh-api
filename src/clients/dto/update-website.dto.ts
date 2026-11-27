import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * A text of the site. It is optional (a form sends only its own fields), but when it is sent it can not be empty:
 * every text of the site is needed before the site can be published.
 */
export const text = (max: number) => {
  return (target: object, key: string) => {
    ApiPropertyOptional({ maxLength: max })(target, key);
    Transform(trim)(target, key);
    IsOptional()(target, key);
    IsString()(target, key);
    IsNotEmpty()(target, key);
    MaxLength(max)(target, key);
  };
};

/** The general info of the site, the pages and the sections have their own routes */
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
}
