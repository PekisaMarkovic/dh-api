import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { Client } from '@/clients/entities/client.entity';
import { CompaniesService } from '@/companies/services/companies.service';
import { Drink } from '@/drinks/entities/drink.entity';
import { MailerService } from '@/mailer/services/mailer.service';
import { CreateOrderDto } from '@/orders/dto/create-order.dto';
import { Order } from '@/orders/entities/order.entity';
import { OrderStatus } from '@/orders/order-status.enum';
import { pickupDateRange } from '@/orders/pickup-date';
import { OrdersService } from '@/orders/services/orders.service';
import { User } from '@/users/entities/user.entity';

jest.mock('nestjs-typeorm-paginate', () => ({
  ...jest.requireActual('nestjs-typeorm-paginate'),
  paginate: jest.fn(),
}));

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let drinkRepository: { find: jest.Mock };
  let clientRepository: { findOne: jest.Mock };
  let companiesService: { findUsers: jest.Mock; assertCanAccess: jest.Mock };
  let mailerService: {
    sendOrderMails: jest.Mock;
    sendOrderCancelledMail: jest.Mock;
  };

  const client = {
    clientId: 'abc',
    companyId: 4,
    name: 'Drink House',
    phone: '+381 15 000',
    isOrderingAllowed: true,
  } as Client;
  const user = { userId: 7, companyId: 4, roles: [] } as unknown as User;

  const dto = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto => ({
    fullName: 'Petar Petrović',
    email: 'petar@example.com',
    phone: '+381 64 123 4567',
    address: 'Bulevar kralja Aleksandra 73, Beograd',
    pickupDate: pickupDateRange().first,
    items: [
      { drinkId: 1, quantity: 2 },
      { drinkId: 2, quantity: 1 },
    ],
    ...overrides,
  });

  const drinks = [
    { drinkId: 1, code: '1', name: 'HEINEKEN 0.25L', price: 150.5 },
    { drinkId: 2, code: '2', name: 'COCA COLA 1L', price: 99.999 },
  ] as Drink[];

  beforeEach(async () => {
    orderRepository = {
      create: jest.fn((entity: Partial<Order>) => entity),
      save: jest.fn((entity: Partial<Order>) =>
        Promise.resolve({ ...entity, orderId: 12 }),
      ),
      findOne: jest.fn(),
    };
    drinkRepository = { find: jest.fn().mockResolvedValue(drinks) };
    clientRepository = { findOne: jest.fn() };
    companiesService = {
      findUsers: jest.fn().mockResolvedValue([
        { email: 'ana@dh.rs', firstName: 'Ana', lastName: 'Anić' },
        { email: null, firstName: 'Bez', lastName: 'Mejla' },
      ]),
      assertCanAccess: jest.fn(),
    };
    mailerService = {
      sendOrderMails: jest.fn().mockResolvedValue(undefined),
      sendOrderCancelledMail: jest.fn().mockResolvedValue(undefined),
    };
    (paginate as jest.Mock).mockReset().mockResolvedValue({ items: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(Drink), useValue: drinkRepository },
        { provide: getRepositoryToken(Client), useValue: clientRepository },
        { provide: CompaniesService, useValue: companiesService },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('create', () => {
    it('should save the order with the names and the prices of the database and the total', async () => {
      const result = await service.create(client, dto());

      expect(result).toEqual({ orderId: 12 });
      const saved = orderRepository.save.mock.calls[0][0];
      expect(saved).toEqual(
        expect.objectContaining({
          companyId: 4,
          clientId: 'abc',
          fullName: 'Petar Petrović',
          // 2 x 150.50 + 1 x 99.999 (100.00)
          total: 401,
        }),
      );
      expect(saved.items).toEqual([
        {
          drinkId: 1,
          code: '1',
          name: 'HEINEKEN 0.25L',
          unitPrice: 150.5,
          quantity: 2,
        },
        {
          drinkId: 2,
          code: '2',
          name: 'COCA COLA 1L',
          unitPrice: 99.999,
          quantity: 1,
        },
      ]);
    });

    it('should look for the drinks only in the company of the site', async () => {
      await service.create(client, dto());

      expect(drinkRepository.find.mock.calls[0][0].where.companyId).toBe(4);
    });

    it('should refuse an order when the site does not allow ordering', async () => {
      await expect(
        service.create(
          { ...client, isOrderingAllowed: false } as Client,
          dto(),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('should refuse a day in the past and a day more than a month ahead', async () => {
      for (const pickupDate of ['2020-01-01', '2999-01-01']) {
        await expect(
          service.create(client, dto({ pickupDate })),
        ).rejects.toThrow(BadRequestException);
      }
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('should refuse a drink that is not on the menu of the company', async () => {
      drinkRepository.find.mockResolvedValue([drinks[0]]);

      await expect(service.create(client, dto())).rejects.toThrow(
        BadRequestException,
      );
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('should send the emails to the employees that have an email and to the buyer', async () => {
      await service.create(client, dto());

      expect(mailerService.sendOrderMails).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 12,
          email: 'petar@example.com',
          address: 'Bulevar kralja Aleksandra 73, Beograd',
          siteName: 'Drink House',
          sitePhone: '+381 15 000',
          recipients: [{ address: 'ana@dh.rs', name: 'Ana Anić' }],
        }),
      );
    });

    it('should keep the order when the emails can not be sent', async () => {
      mailerService.sendOrderMails.mockRejectedValue(new Error('down'));

      await expect(service.create(client, dto())).resolves.toEqual({
        orderId: 12,
      });
    });
  });

  describe('isEnabled', () => {
    it('should say yes when the site of the company allows ordering', async () => {
      clientRepository.findOne.mockResolvedValue({ clientId: 'abc' });

      await expect(service.isEnabled(user)).resolves.toEqual({
        isOrderingAllowed: true,
      });
      expect(clientRepository.findOne.mock.calls[0][0].where).toEqual({
        companyId: 4,
        isOrderingAllowed: true,
      });
    });

    it('should say no when it does not or the user has no company', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(service.isEnabled(user)).resolves.toEqual({
        isOrderingAllowed: false,
      });
      await expect(
        service.isEnabled({ ...user, companyId: null } as unknown as User),
      ).resolves.toEqual({ isOrderingAllowed: false });
    });
  });

  describe('findAll', () => {
    it('should return the orders of the company of the user, the newest first', async () => {
      await service.findAll(user, { page: 1, limit: 10 });

      expect((paginate as jest.Mock).mock.calls[0][2]).toEqual({
        where: { companyId: 4 },
        order: { createdAt: 'DESC', orderId: 'DESC' },
      });
    });

    it('should filter by the status and find nothing without a company', async () => {
      await service.findAll({ ...user, companyId: null } as unknown as User, {
        page: 1,
        limit: 10,
        status: OrderStatus.NEW,
      });

      expect((paginate as jest.Mock).mock.calls[0][2].where).toEqual({
        companyId: -1,
        status: 'new',
      });
    });
  });

  describe('findOne and updateStatus', () => {
    it('should throw NotFoundException when there is no such order', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1, user)).rejects.toThrow(NotFoundException);
    });

    it('should not show the order of another company', async () => {
      orderRepository.findOne.mockResolvedValue({ orderId: 1, companyId: 9 });
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.findOne(1, user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    const stored = (status: OrderStatus, cancelReason: string | null = null) =>
      ({
        orderId: 1,
        companyId: 4,
        clientId: 'abc',
        fullName: 'Petar Petrović',
        email: 'petar@example.com',
        phone: '+381 64 123 4567',
        address: 'Bulevar kralja Aleksandra 73, Beograd',
        pickupDate: '2026-11-27',
        total: 401,
        items: [],
        status,
        cancelReason,
      }) as unknown as Order;

    beforeEach(() =>
      clientRepository.findOne.mockResolvedValue({
        name: 'Drink House',
        phone: '+381 15 000',
      }),
    );

    it('should move the order on without an email (in progress, delivered)', async () => {
      for (const status of [OrderStatus.IN_PROGRESS, OrderStatus.DELIVERED]) {
        orderRepository.findOne.mockResolvedValue(stored(OrderStatus.NEW));

        const result = await service.updateStatus(1, { status }, user);

        expect(result.status).toBe(status);
      }
      expect(mailerService.sendOrderCancelledMail).not.toHaveBeenCalled();
    });

    it('should cancel with the reason and send it to the buyer', async () => {
      orderRepository.findOne.mockResolvedValue(
        stored(OrderStatus.IN_PROGRESS),
      );

      const result = await service.updateStatus(
        1,
        { status: OrderStatus.CANCELLED, reason: 'Nema na stanju.' },
        user,
      );

      expect(result.cancelReason).toBe('Nema na stanju.');
      expect(mailerService.sendOrderCancelledMail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'petar@example.com',
          reason: 'Nema na stanju.',
          siteName: 'Drink House',
          sitePhone: '+381 15 000',
        }),
      );
    });

    it('should cancel without a reason too', async () => {
      orderRepository.findOne.mockResolvedValue(stored(OrderStatus.NEW));

      await service.updateStatus(1, { status: OrderStatus.CANCELLED }, user);

      expect(mailerService.sendOrderCancelledMail).toHaveBeenCalledWith(
        expect.objectContaining({ reason: null }),
      );
    });

    it('should not send the email again for an order that is already cancelled', async () => {
      orderRepository.findOne.mockResolvedValue(
        stored(OrderStatus.CANCELLED, 'Prvi razlog'),
      );

      await service.updateStatus(1, { status: OrderStatus.CANCELLED }, user);

      expect(mailerService.sendOrderCancelledMail).not.toHaveBeenCalled();
    });

    it('should forget the reason when a cancelled order is opened again', async () => {
      orderRepository.findOne.mockResolvedValue(
        stored(OrderStatus.CANCELLED, 'Nema na stanju.'),
      );

      const result = await service.updateStatus(
        1,
        { status: OrderStatus.NEW },
        user,
      );

      expect(result.cancelReason).toBeNull();
    });
  });
});
