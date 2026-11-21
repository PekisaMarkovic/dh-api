import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class ParsePurchaseDto {
  @ApiProperty({ description: 'The warehouse the drinks are added to' })
  @Type(() => Number)
  @IsInt()
  warehouseId: number;
}

export class PurchaseItemDto {
  @ApiProperty({
    description: 'The line of the document, from the parse result',
  })
  @IsInt()
  purchaseImportItemId: number;

  @ApiProperty()
  @IsInt()
  drinkId: number;

  @ApiProperty({ description: 'How many units are added to the stock' })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class ApplyPurchaseDto {
  @ApiProperty({
    description: 'The import the lines belong to, from the parse result',
  })
  @IsInt()
  purchaseImportId: number;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}
