import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateWebsiteDto } from '@/clients/dto/update-website.dto';

const check = (plain: object) =>
  validate(plainToInstance(UpdateWebsiteDto, plain));

describe('UpdateWebsiteDto', () => {
  it('should accept an empty body and a partial one', async () => {
    expect(await check({})).toEqual([]);
    expect(await check({ city: 'Šabac', hero: { title: 'Naslov' } })).toEqual(
      [],
    );
  });

  it('should accept a complete body of every kind', async () => {
    expect(
      await check({
        name: 'Drink House',
        phone: '+381 15 000 000',
        instagram: 'https://instagram.com/drinkhouse',
        workingHours: 'Ponedeljak: 07:00-19:00\nUtorak: 07:00-19:00',
        story: { paragraph1: 'a', paragraph2: 'b' },
        featured: { drinkIds: [1, 2] },
      }),
    ).toEqual([]);
  });

  it.each([
    [{ instagram: 'not an address' }],
    [{ instagram: '' }],
    [{ name: '' }],
    [{ city: '' }],
    [{ address: '   ' }],
    [{ phone: '' }],
    [{ phone: 'abc' }],
    [{ workingHours: '' }],
    [{ hero: { title: '' } }],
    [{ hero: { buttonText: '  ' } }],
    [{ story: { paragraph2: '' } }],
    [{ promo: { text: '' } }],
    [{ featured: { title: '' } }],
    [{ featured: { drinkIds: [] } }],
    [{ city: 'x'.repeat(101) }],
    [{ hero: { title: 'x'.repeat(151) } }],
    [{ featured: { drinkIds: [1, 1] } }],
    [{ featured: { drinkIds: Array.from({ length: 11 }, (_, i) => i + 1) } }],
    [{ featured: { drinkIds: [0] } }],
    [{ story: { paragraph1: 5 } }],
  ])('should reject %j', async (plain) => {
    expect((await check(plain)).length).toBeGreaterThan(0);
  });

  it('should trim the texts', () => {
    const dto = plainToInstance(UpdateWebsiteDto, {
      city: '  Loznica ',
      hero: { title: ' T ' },
    });

    expect(dto.city).toBe('Loznica');
    expect(dto.hero?.title).toBe('T');
  });
});
