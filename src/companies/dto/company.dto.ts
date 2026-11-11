import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
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
  @MaxLength(20)
  pib: string;

  @ApiProperty({ example: '12345678' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  registrationNumber: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }) => (trim({ value }) === '' ? null : trim({ value })))
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiProperty({ example: '160600000012345678' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  bankAccount: string;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
