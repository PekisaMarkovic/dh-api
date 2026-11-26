import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

/** ?page=1&limit=20&search=text&categoryId=3 */
export class PublicDrinksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Only the drinks of this category (see GET public/drinks/categories)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;
}
