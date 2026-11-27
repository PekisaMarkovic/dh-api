import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateDrinkDto } from '@/drinks/dto/drink.dto';

describe('the description of a drink', () => {
  const dto = (description: unknown) =>
    plainToInstance(UpdateDrinkDto, { description });

  it('should trim it and make an empty one null (it removes the description)', () => {
    expect(dto('  Lagano pivo ').description).toBe('Lagano pivo');
    expect(dto('   ').description).toBeNull();
  });

  it('should allow at most 150 characters', async () => {
    expect(await validate(dto('x'.repeat(150)))).toEqual([]);
    expect((await validate(dto('x'.repeat(151)))).length).toBe(1);
  });
});
