import { paginate } from 'nestjs-typeorm-paginate';
import { Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { PublicDrinksService } from '@/clients/services/public-drinks.service';
import { Drink } from '@/drinks/entities/drink.entity';

jest.mock('nestjs-typeorm-paginate', () => ({
  ...jest.requireActual('nestjs-typeorm-paginate'),
  paginate: jest.fn(),
}));

describe('PublicDrinksService', () => {
  const client = { clientId: 'x', companyId: 4 } as Client;
  const repository = {} as Repository<Drink>;
  const service = new PublicDrinksService(repository);

  beforeEach(() => (paginate as jest.Mock).mockReset());

  it('should return only the drinks of the company of the client, by name', async () => {
    (paginate as jest.Mock).mockResolvedValue({ items: [], meta: {} });

    await service.findAll(client, { page: 1, limit: 10 });

    expect(paginate).toHaveBeenCalledWith(
      repository,
      { page: 1, limit: 10 },
      { where: { companyId: 4 }, order: { name: 'ASC', drinkId: 'ASC' } },
    );
  });

  it('should search the name', async () => {
    (paginate as jest.Mock).mockResolvedValue({ items: [], meta: {} });

    await service.findAll(client, { page: 1, limit: 10, search: 'fanta' });

    const where = (paginate as jest.Mock).mock.calls[0][2].where;
    expect(where).toEqual(
      expect.objectContaining({ companyId: 4, name: expect.anything() }),
    );
  });

  it('should show only what the site needs: no warehouse, no stock numbers', async () => {
    (paginate as jest.Mock).mockResolvedValue({
      items: [
        {
          drinkId: 1,
          name: 'FANTA',
          price: 150,
          quantity: 24,
          warningQuantity: 5,
          criticalQuantity: 2,
          warehouseId: 9,
          companyId: 4,
          code: '352',
          image: {
            url: 'https://cdn/a.webp',
            altText: 'Fanta',
            width: 800,
            height: 600,
            key: 'secret/key',
          },
        },
        { drinkId: 2, name: 'COLA', price: 100, quantity: 0, image: null },
      ],
      meta: { totalPages: 1 },
    });

    const result = await service.findAll(client, { page: 1, limit: 10 });

    expect(result.items).toEqual([
      {
        drinkId: 1,
        name: 'FANTA',
        price: 150,
        inStock: true,
        image: {
          url: 'https://cdn/a.webp',
          altText: 'Fanta',
          width: 800,
          height: 600,
        },
      },
      { drinkId: 2, name: 'COLA', price: 100, inStock: false, image: null },
    ]);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.meta).toEqual({ totalPages: 1 });
  });
});
