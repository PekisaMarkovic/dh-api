import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from '@/orders/dto/create-order.dto';

describe('CreateOrderDto', () => {
  const valid = {
    fullName: ' Petar Petrović ',
    email: 'petar@example.com',
    phone: '+381 64 123 4567',
    address: 'Bulevar kralja Aleksandra 73, Beograd',
    pickupDate: '2026-11-27',
    items: [{ drinkId: 1, quantity: 2 }],
  };

  const errorsOf = async (body: object) =>
    (await validate(plainToInstance(CreateOrderDto, body))).map(
      (e) => e.property,
    );

  it('should accept a complete order and trim the texts', async () => {
    const dto = plainToInstance(CreateOrderDto, valid);

    expect(await validate(dto)).toEqual([]);
    expect(dto.fullName).toBe('Petar Petrović');
  });

  it('should refuse a missing or a bad contact', async () => {
    expect(await errorsOf({ ...valid, fullName: ' ' })).toContain('fullName');
    expect(await errorsOf({ ...valid, email: 'petar' })).toContain('email');
    expect(await errorsOf({ ...valid, phone: 'abc' })).toContain('phone');
    expect(await errorsOf({ ...valid, address: ' ab ' })).toContain('address');
  });

  it('should refuse a date that is not a day', async () => {
    for (const pickupDate of [
      '27.11.2026',
      '2026-13-01',
      '2026-11-27T10:00',
      '',
    ]) {
      expect(await errorsOf({ ...valid, pickupDate })).toContain('pickupDate');
    }
  });

  it('should refuse an empty cart, a drink twice and a bad quantity', async () => {
    expect(await errorsOf({ ...valid, items: [] })).toContain('items');
    expect(
      await errorsOf({
        ...valid,
        items: [
          { drinkId: 1, quantity: 1 },
          { drinkId: 1, quantity: 2 },
        ],
      }),
    ).toContain('items');

    for (const quantity of [0, -1, 1.5, 1000]) {
      expect(
        await errorsOf({ ...valid, items: [{ drinkId: 1, quantity }] }),
      ).toContain('items');
    }
  });
});
