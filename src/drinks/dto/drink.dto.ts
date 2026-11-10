import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDrinkDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 2.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999)
  price: number;

  @ApiProperty({ example: 24 })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsInt()
  warehouseId: number;
}

export class UpdateDrinkDto extends PartialType(
  OmitType(CreateDrinkDto, ['warehouseId'] as const),
) {}
