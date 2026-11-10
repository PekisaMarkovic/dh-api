import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateProformaItemDto {
  @ApiProperty()
  @IsInt()
  drinkId: number;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    required: false,
    example: 2.5,
    description:
      'Price per unit for this proforma only, the price of the drink is used when it is missing',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(99999999)
  unitPrice?: number;

  @ApiProperty({
    required: false,
    example: 10,
    description: 'Discount in percent, 0 - 100, lowers the price of this drink',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;
}

export class CreateProformaDto {
  @ApiProperty()
  @IsInt()
  warehouseId: number;

  @ApiProperty({ required: false, description: 'The buyer, can be left out' })
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiProperty({ type: [CreateProformaItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProformaItemDto)
  items: CreateProformaItemDto[];
}
