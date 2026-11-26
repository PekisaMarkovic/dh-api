import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

/** ?categoryIds=1,4: only the drinks in any of these categories (the dashboard and the site) */
export const CategoryIdsQuery = () =>
  applyDecorators(
    ApiPropertyOptional({
      type: String,
      example: '1,4',
      description:
        'Only the drinks in any of these categories (ids separated by commas)',
    }),
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      String(value)
        .split(',')
        .filter(Boolean)
        .map((id) => Number(id)),
    ),
    IsArray(),
    ArrayMaxSize(50),
    IsInt({ each: true }),
    Min(1, { each: true }),
  );

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

  @CategoryIdsQuery()
  categoryIds?: number[];
}
