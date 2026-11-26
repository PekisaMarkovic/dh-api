import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindDrinksDto } from '@/drinks/dto/find-drinks.dto';

describe('FindDrinksDto', () => {
  const parse = async (query: Record<string, string>) => {
    const dto = plainToInstance(FindDrinksDto, query);

    return { dto, errors: await validate(dto) };
  };

  it('should read several categories separated by commas', async () => {
    const { dto, errors } = await parse({ categoryIds: '1,4' });

    expect(errors).toHaveLength(0);
    expect(dto.categoryIds).toEqual([1, 4]);
  });

  it('should read one category', async () => {
    const { dto, errors } = await parse({ categoryIds: '3' });

    expect(errors).toHaveLength(0);
    expect(dto.categoryIds).toEqual([3]);
  });

  it('should refuse a category that is not a whole number from 1 up', async () => {
    for (const categoryIds of ['abc', '1,x', '0', '-2', '1.5']) {
      const { errors } = await parse({ categoryIds });

      expect(errors.map((e) => e.property)).toContain('categoryIds');
    }
  });
});
