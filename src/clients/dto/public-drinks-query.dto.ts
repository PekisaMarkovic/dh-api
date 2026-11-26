import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { CategoryIdsQuery } from '@/drinks/dto/find-drinks.dto';

/** ?page=1&limit=20&search=text&categoryIds=1,4 */
export class PublicDrinksQueryDto extends PaginationQueryDto {
  @CategoryIdsQuery()
  categoryIds?: number[];
}
