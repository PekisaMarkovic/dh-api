import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDrinkDto {
  @ApiProperty({
    description: 'Article code, unique in the company',
    example: '352',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 2304.5, description: 'Up to 3 decimals' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(99999999)
  price: number;

  @ApiProperty({ example: 24 })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty({
    required: false,
    example: 12,
    description: 'Orange warning when the quantity falls below this, 0 = off',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  warningQuantity?: number;

  @ApiProperty({
    required: false,
    example: 5,
    description: 'Red, has to be bought again, below this, 0 = off',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  criticalQuantity?: number;

  @ApiProperty()
  @IsInt()
  warehouseId: number;
}

export class UpdateDrinkDto extends PartialType(
  OmitType(CreateDrinkDto, ['warehouseId'] as const),
) {}
