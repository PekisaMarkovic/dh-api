import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// digits, +, -, spaces, brackets, the same as the form of the site
export const PHONE_PATTERN = /^[0-9+\-()\s/.]{6,30}$/;

export class CreateContactDto {
  @ApiProperty({ example: 'Petar Petrović' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: '+381 64 123 4567' })
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone: string;

  @ApiPropertyOptional({ example: 'petar@example.com' })
  @Transform(({ value }) => {
    const text = trim({ value });

    // an empty field of the form is no email
    return text === '' ? undefined : text;
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({
    description: 'What the visitor needs, at most 2000 characters',
  })
  @Transform(({ value }) => {
    const text = trim({ value });

    return text === '' ? undefined : text;
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
