import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
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
}

export class CreateProformaDto {
  @ApiProperty()
  @IsInt()
  warehouseId: number;

  @ApiProperty({ type: [CreateProformaItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProformaItemDto)
  items: CreateProformaItemDto[];
}
