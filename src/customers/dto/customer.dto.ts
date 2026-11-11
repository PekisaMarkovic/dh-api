import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
// an empty text is saved as "nothing"
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateCustomerDto {
  @ApiProperty({
    example: '12',
    description: 'Customer code (sifra), unique in the company',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Privatna žurka' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ nullable: true, example: 'LOZNICA' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Vojvode Misića 2A' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '115641754' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pib?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'SRB' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  type?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+38115891664' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'kupac@example.com' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string | null;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
