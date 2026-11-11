import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCompanyDto {
  @ApiProperty({ example: 'KNEZ BAR' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'KNEZ MIHAILOVA 22' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  street: string;

  @ApiProperty({ example: 'BEOGRAD' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: '123456789' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{9}$/, { message: 'pib must be exactly 9 digits' })
  pib: string;

  @ApiProperty({ example: '12345678' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, {
    message: 'registrationNumber must be exactly 8 digits',
  })
  registrationNumber: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }) => (trim({ value }) === '' ? null : trim({ value })))
  @IsString()
  @Matches(/^[0-9+()/\-\s]{5,50}$/, {
    message:
      'phone can have digits, +, -, spaces and brackets (5 - 50 characters)',
  })
  phone?: string | null;

  @ApiProperty({ example: '160600000012345678' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\d{18}|\d{3}-\d{1,13}-\d{2})$/, {
    message:
      'bankAccount must be 18 digits or in the form 160-0000002761287-85',
  })
  bankAccount: string;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
