import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export enum DrinkStockLevel {
  /** orange: below the warning quantity, but not yet critical */
  WARNING = 'warning',
  /** red: below the critical quantity, has to be bought again */
  CRITICAL = 'critical',
}

export class FindDrinksDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only the drinks of this warehouse' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @ApiPropertyOptional({
    enum: DrinkStockLevel,
    description:
      'warning = orange, critical = red (below zero is always critical)',
  })
  @IsOptional()
  @IsEnum(DrinkStockLevel)
  stockLevel?: DrinkStockLevel;
}
