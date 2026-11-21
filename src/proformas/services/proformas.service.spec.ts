import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { CompaniesService } from '@/companies/services/companies.service';
import { CustomersService } from '@/customers/services/customers.service';
import { Drink } from '@/drinks/entities/drink.entity';
import { PdfService } from '@/pdf/services/pdf.service';
import { ProformaItem } from '@/proformas/entities/proforma-item.entity';
import { Proforma } from '@/proformas/entities/proforma.entity';
import { ProformaStatusEnums } from '@/proformas/enums/proforma-status.enum';
import { ProformasService } from '@/proformas/services/proformas.service';
import { User } from '@/users/entities/user.entity';
import { WarehousesService } from '@/warehouses/services/warehouses.service';

jest.mock('nestjs-typeorm-paginate', () => ({
  ...jest.requireActual('nestjs-typeorm-paginate'),
  paginate: jest.fn(),
}));

describe('ProformasService', () => {
  let service: ProformasService;
  let proformaRepository: {
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  // the manager of the transaction
  let manager: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    increment: jest.Mock;
    decrement: jest.Mock;
  };
  let warehousesService: { findOne: jest.Mock };
  let customersService: { findOne: jest.Mock };
  let companiesService: { assertCanAccess: jest.Mock; findOne: jest.Mock };
  let pdfService: { renderProforma: jest.Mock };

  const user = { userId: 7, companyId: 1, roles: [] } as unknown as User;
  const warehouse = { warehouseId: 5, companyId: 1 };

  // a drink of the warehouse, the price is with VAT
  const drink = (drinkId: number, price: number) => ({
    drinkId,
    code: String(drinkId),
    name: `DRINK ${drinkId}`,
    price,
    warehouseId: 5,
  });

  // what the database returns for a proforma, the lines are not sorted on purpose
  const storedProforma = (overrides: Record<string, unknown> = {}) => ({
    proformaId: 40,
    companyId: 1,
    warehouseId: 5,
    customerName: 'PRIVATNA ZURKA',
    total: 9756,
    status: ProformaStatusEnums.ACTIVE,
    createdAt: new Date('2026-11-09T10:00:00Z'),
    warehouse: { name: 'Magacin 1' },
    createdBy: { firstName: 'Super', lastName: 'Admin' },
    items: [
      { proformaItemId: 2, lineTotal: 5184 },
      { proformaItemId: 1, lineTotal: 3970 },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    manager = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    };
    proformaRepository = {
      findOne: jest.fn().mockResolvedValue(storedProforma()),
      manager: {
        transaction: jest.fn((callback: (manager: unknown) => unknown) =>
          callback(manager),
        ),
      },
    };
    warehousesService = { findOne: jest.fn().mockResolvedValue(warehouse) };
    customersService = { findOne: jest.fn() };
    companiesService = { assertCanAccess: jest.fn(), findOne: jest.fn() };
    pdfService = { renderProforma: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProformasService,
        { provide: getRepositoryToken(Proforma), useValue: proformaRepository },
        { provide: WarehousesService, useValue: warehousesService },
        { provide: CustomersService, useValue: customersService },
        { provide: CompaniesService, useValue: companiesService },
        { provide: PdfService, useValue: pdfService },
      ],
    }).compile();

    service = module.get(ProformasService);
  });

  describe('create', () => {
    beforeEach(() => {
      manager.find.mockResolvedValue([drink(1, 100), drink(2, 90)]);
      manager.save.mockResolvedValue({ proformaId: 40 });
    });

    it('should not create a proforma for a warehouse of another company', async () => {
      warehousesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(
        service.create(
          { warehouseId: 5, items: [{ drinkId: 1, quantity: 1 }] },
          user,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(proformaRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when a drink is on the proforma twice', async () => {
      await expect(
        service.create(
          {
            warehouseId: 5,
            items: [
              { drinkId: 1, quantity: 1 },
              { drinkId: 1, quantity: 2 },
            ],
          },
          user,
        ),
      ).rejects.toThrow(
        new BadRequestException('Each drink can be added only once'),
      );
      expect(proformaRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('should lock the drinks of the warehouse so the same stock can not be sold twice', async () => {
      await service.create(
        { warehouseId: 5, items: [{ drinkId: 1, quantity: 1 }] },
        user,
      );

      expect(manager.find).toHaveBeenCalledWith(
        Drink,
        expect.objectContaining({
          where: { drinkId: expect.anything(), warehouseId: 5 },
          lock: { mode: 'pessimistic_write' },
        }),
      );
    });

    it('should throw BadRequestException when a drink is not in the warehouse, without changing the stock', async () => {
      manager.find.mockResolvedValue([drink(1, 100)]);

      await expect(
        service.create(
          {
            warehouseId: 5,
            items: [
              { drinkId: 1, quantity: 1 },
              { drinkId: 2, quantity: 1 },
            ],
          },
          user,
        ),
      ).rejects.toThrow(
        new BadRequestException('Drink 2 is not in this warehouse'),
      );
      expect(manager.decrement).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should take the quantities off the stock', async () => {
      await service.create(
        {
          warehouseId: 5,
          items: [
            { drinkId: 1, quantity: 3 },
            { drinkId: 2, quantity: 48 },
          ],
        },
        user,
      );

      expect(manager.decrement).toHaveBeenCalledWith(
        Drink,
        { drinkId: 1 },
        'quantity',
        3,
      );
      expect(manager.decrement).toHaveBeenCalledWith(
        Drink,
        { drinkId: 2 },
        'quantity',
        48,
      );
    });

    it('should use the price of the drink and copy its code and name to the line', async () => {
      await service.create(
        { warehouseId: 5, items: [{ drinkId: 1, quantity: 2 }] },
        user,
      );

      const data = manager.create.mock.calls[0][1] as {
        items: Partial<ProformaItem>[];
        total: number;
      };
      expect(data.items[0]).toEqual(
        expect.objectContaining({
          drinkId: 1,
          code: '1',
          name: 'DRINK 1',
          unitPrice: 100,
          quantity: 2,
          discountPercent: 0,
          lineTotal: 200,
        }),
      );
      expect(data.total).toBe(200);
    });

    it('should use the price and the discount of the proforma, the drink keeps its price', async () => {
      await service.create(
        {
          warehouseId: 5,
          items: [
            { drinkId: 1, quantity: 3, discountPercent: 10 },
            { drinkId: 2, quantity: 6, unitPrice: 2.5 },
          ],
        },
        user,
      );

      const data = manager.create.mock.calls[0][1] as {
        items: Partial<ProformaItem>[];
        total: number;
      };
      // 3 x 100 - 10 % = 270, 6 x 2.5 = 15
      expect(data.items.map((item) => item.lineTotal)).toEqual([270, 15]);
      expect(data.total).toBe(285);
    });

    it('should save an active proforma of the company of the warehouse, made by the user', async () => {
      await service.create(
        { warehouseId: 5, items: [{ drinkId: 1, quantity: 1 }] },
        user,
      );

      expect(manager.create).toHaveBeenCalledWith(
        Proforma,
        expect.objectContaining({
          companyId: 1,
          warehouseId: 5,
          createdById: 7,
          customerId: null,
          customerName: null,
          status: ProformaStatusEnums.ACTIVE,
        }),
      );
    });

    it('should copy the name of the buyer to the proforma', async () => {
      customersService.findOne.mockResolvedValue({
        customerId: 9,
        name: 'PRIVATNA ZURKA',
      });

      await service.create(
        { warehouseId: 5, customerId: 9, items: [{ drinkId: 1, quantity: 1 }] },
        user,
      );

      expect(customersService.findOne).toHaveBeenCalledWith(9, user);
      expect(manager.create).toHaveBeenCalledWith(
        Proforma,
        expect.objectContaining({
          customerId: 9,
          customerName: 'PRIVATNA ZURKA',
        }),
      );
    });

    it('should not look for a buyer when there is none', async () => {
      await service.create(
        { warehouseId: 5, items: [{ drinkId: 1, quantity: 1 }] },
        user,
      );

      expect(customersService.findOne).not.toHaveBeenCalled();
    });

    it('should return the saved proforma with its number', async () => {
      const result = await service.create(
        { warehouseId: 5, items: [{ drinkId: 1, quantity: 1 }] },
        user,
      );

      expect(proformaRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { proformaId: 40 } }),
      );
      expect(result.number).toBe('PR-000040');
    });
  });

  describe('update', () => {
    const oldProforma = {
      proformaId: 40,
      companyId: 1,
      warehouseId: 5,
      status: ProformaStatusEnums.ACTIVE,
    };
    // before: 5 x drink 1 and 2 x drink 2
    const oldItems = [
      { drinkId: 1, quantity: 5 },
      { drinkId: 2, quantity: 2 },
      // the drink was deleted, nothing to correct
      { drinkId: null, quantity: 9 },
    ];

    beforeEach(() => {
      manager.findOne.mockResolvedValue(oldProforma);
      manager.find
        .mockResolvedValueOnce(oldItems)
        .mockResolvedValueOnce([drink(1, 100), drink(2, 90), drink(3, 50)]);
    });

    it('should throw BadRequestException when a drink is on the proforma twice', async () => {
      await expect(
        service.update(
          40,
          {
            items: [
              { drinkId: 1, quantity: 1 },
              { drinkId: 1, quantity: 2 },
            ],
          },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(proformaRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when there is no such proforma', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.update(40, { items: [{ drinkId: 1, quantity: 1 }] }, user),
      ).rejects.toThrow(new NotFoundException('Proforma not found'));
    });

    it('should not change the proforma of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(
        service.update(40, { items: [{ drinkId: 1, quantity: 1 }] }, user),
      ).rejects.toThrow(ForbiddenException);
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the proforma is returned', async () => {
      manager.findOne.mockResolvedValue({
        ...oldProforma,
        status: ProformaStatusEnums.RETURNED,
      });

      await expect(
        service.update(40, { items: [{ drinkId: 1, quantity: 1 }] }, user),
      ).rejects.toThrow(
        new ConflictException('Only an active proforma can be changed'),
      );
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('should correct the stock by the difference to the old lines', async () => {
      await service.update(
        40,
        {
          items: [
            { drinkId: 1, quantity: 3 },
            { drinkId: 3, quantity: 4 },
          ],
        },
        user,
      );

      // drink 1: sold 5, now 3, so 2 go back; drink 2 is not on the proforma any more, 2 go back;
      // drink 3 is new, 4 are taken
      expect(manager.increment).toHaveBeenCalledWith(
        Drink,
        { drinkId: 1 },
        'quantity',
        2,
      );
      expect(manager.increment).toHaveBeenCalledWith(
        Drink,
        { drinkId: 2 },
        'quantity',
        2,
      );
      expect(manager.increment).toHaveBeenCalledWith(
        Drink,
        { drinkId: 3 },
        'quantity',
        -4,
      );
      expect(manager.increment).toHaveBeenCalledTimes(3);
    });

    it('should not touch the stock of a drink whose quantity did not change', async () => {
      await service.update(
        40,
        {
          items: [
            { drinkId: 1, quantity: 5 },
            { drinkId: 2, quantity: 2 },
          ],
        },
        user,
      );

      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('should replace the lines and save the new total', async () => {
      await service.update(
        40,
        { items: [{ drinkId: 1, quantity: 3, discountPercent: 10 }] },
        user,
      );

      expect(manager.delete).toHaveBeenCalledWith(ProformaItem, {
        proformaId: 40,
      });
      expect(manager.save).toHaveBeenCalledWith([
        expect.objectContaining({ proformaId: 40, drinkId: 1, lineTotal: 270 }),
      ]);
      expect(manager.update).toHaveBeenCalledWith(
        Proforma,
        { proformaId: 40 },
        { total: 270 },
      );
    });

    it('should keep the buyer when the request says nothing about it', async () => {
      await service.update(40, { items: [{ drinkId: 1, quantity: 1 }] }, user);

      expect(customersService.findOne).not.toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledWith(
        Proforma,
        { proformaId: 40 },
        expect.not.objectContaining({ customerId: expect.anything() }),
      );
    });

    it('should change the buyer', async () => {
      customersService.findOne.mockResolvedValue({
        customerId: 9,
        name: 'PRIVATNA ZURKA',
      });

      await service.update(
        40,
        { customerId: 9, items: [{ drinkId: 1, quantity: 1 }] },
        user,
      );

      expect(manager.update).toHaveBeenCalledWith(
        Proforma,
        { proformaId: 40 },
        expect.objectContaining({
          customerId: 9,
          customerName: 'PRIVATNA ZURKA',
        }),
      );
    });
  });

  describe('findAll', () => {
    const query = { page: 1, limit: 10 };

    beforeEach(() => {
      (paginate as jest.Mock).mockReset().mockResolvedValue({
        items: [storedProforma()],
        meta: {
          totalItems: 1,
          itemCount: 1,
          itemsPerPage: 10,
          totalPages: 1,
          currentPage: 1,
        },
      });
    });

    const whereOf = () =>
      (
        (paginate as jest.Mock).mock.calls[0][2] as {
          where: Record<string, unknown>[];
        }
      ).where;

    it('should only look at the proformas of the company of the user, newest first', async () => {
      await service.findAll(user, query);

      expect(paginate).toHaveBeenCalledWith(
        proformaRepository,
        query,
        expect.objectContaining({
          where: [{ companyId: 1 }],
          order: { createdAt: 'DESC', proformaId: 'DESC' },
        }),
      );
    });

    it('should find nothing for a user without a company', async () => {
      await service.findAll(
        { ...user, companyId: null } as unknown as User,
        query,
      );

      expect(whereOf()).toEqual([{ companyId: -1 }]);
    });

    it('should search the buyer and the warehouse', async () => {
      await service.findAll(user, { ...query, search: 'zurka' });

      expect(whereOf()).toHaveLength(2);
      expect(whereOf()[0]).toHaveProperty('customerName');
      expect(whereOf()[1]).toHaveProperty('warehouse');
    });

    it('should find a proforma by its number, with or without the prefix', async () => {
      await service.findAll(user, { ...query, search: 'PR-000012' });

      expect(whereOf()).toHaveLength(3);
      expect(whereOf()[2]).toEqual({ companyId: 1, proformaId: 12 });
    });

    it('should not search the number when there are too many digits for an id', async () => {
      await service.findAll(user, { ...query, search: '1234567890123' });

      expect(whereOf()).toHaveLength(2);
    });

    it('should return the number, the VAT, the total and the names, without the lines', async () => {
      const result = await service.findAll(user, query);

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          number: 'PR-000040',
          vatAmount: 1525.67,
          totalWithVat: 9154,
          warehouseName: 'Magacin 1',
          createdByName: 'Super Admin',
        }),
      );
      expect(result.items[0]).not.toHaveProperty('items');
      expect(result.items[0]).not.toHaveProperty('createdBy');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when there is no such proforma', async () => {
      proformaRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(99, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not return the proforma of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.findOne(40, user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return the lines in the order they were added', async () => {
      const result = await service.findOne(40, user);

      expect(result.items.map((item) => item.proformaItemId)).toEqual([1, 2]);
    });

    it('should return the number made of the id', async () => {
      const result = await service.findOne(40, user);

      expect(result.number).toBe('PR-000040');
    });

    it('should return the VAT and the amount to pay out of the lines', async () => {
      const result = await service.findOne(40, user);

      expect(result.vatAmount).toBe(1525.67);
      expect(result.totalWithVat).toBe(9154);
    });

    it('should return the names of the warehouse and of the user who made it', async () => {
      const result = await service.findOne(40, user);

      expect(result).toEqual(
        expect.objectContaining({
          warehouseName: 'Magacin 1',
          createdByName: 'Super Admin',
        }),
      );
      expect(result).not.toHaveProperty('createdBy');
    });

    it('should return empty names when the warehouse or the user are gone', async () => {
      proformaRepository.findOne.mockResolvedValue(
        storedProforma({ warehouse: null, createdBy: null }),
      );

      const result = await service.findOne(40, user);

      expect(result.warehouseName).toBe('');
      expect(result.createdByName).toBe('');
    });
  });

  describe('returnToStock', () => {
    const active = {
      proformaId: 40,
      companyId: 1,
      status: ProformaStatusEnums.ACTIVE,
    };

    beforeEach(() => {
      manager.findOne.mockResolvedValue(active);
      manager.find.mockResolvedValue([
        { drinkId: 1, quantity: 5 },
        { drinkId: 2, quantity: 2 },
        // the drink was deleted in the meantime
        { drinkId: null, quantity: 9 },
      ]);
    });

    it('should throw NotFoundException when there is no such proforma', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.returnToStock(40, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not return the proforma of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.returnToStock(40, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when it was already returned, so the stock is not added twice', async () => {
      manager.findOne.mockResolvedValue({
        ...active,
        status: ProformaStatusEnums.RETURNED,
      });

      await expect(service.returnToStock(40, user)).rejects.toThrow(
        new ConflictException('Proforma is already returned to stock'),
      );
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('should put the drinks back on the stock and skip the deleted ones', async () => {
      await service.returnToStock(40, user);

      expect(manager.increment).toHaveBeenCalledTimes(2);
      expect(manager.increment).toHaveBeenCalledWith(
        Drink,
        { drinkId: 1 },
        'quantity',
        5,
      );
      expect(manager.increment).toHaveBeenCalledWith(
        Drink,
        { drinkId: 2 },
        'quantity',
        2,
      );
    });

    it('should mark the proforma as returned, by whom and when', async () => {
      await service.returnToStock(40, user);

      expect(manager.update).toHaveBeenCalledWith(
        Proforma,
        { proformaId: 40 },
        {
          status: ProformaStatusEnums.RETURNED,
          returnedAt: expect.any(Date),
          returnedById: 7,
        },
      );
    });

    it('should return the proforma', async () => {
      const result = await service.returnToStock(40, user);

      expect(result.number).toBe('PR-000040');
    });
  });

  describe('createPdf', () => {
    const company = {
      name: 'DRINK HOUSE',
      street: 'FILIPA KLJAJICA 82',
      city: 'LOZNICA',
      pib: '115962350',
      registrationNumber: '68783143',
      phone: null,
      bankAccount: '160600000276128785',
      invoiceName: 'Milutin',
    };

    beforeEach(() => {
      companiesService.findOne.mockResolvedValue(company);
      pdfService.renderProforma.mockResolvedValue(Buffer.from('%PDF'));
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });

    it('should return the file with the number of the proforma as its name', async () => {
      const result = await service.createPdf(40, user);

      expect(result).toEqual({
        buffer: Buffer.from('%PDF'),
        filename: 'PR-000040.pdf',
      });
    });

    it('should print the data of the company of the proforma as the seller', async () => {
      await service.createPdf(40, user);

      expect(companiesService.findOne).toHaveBeenCalledWith(1);
      expect(pdfService.renderProforma).toHaveBeenCalledWith(
        expect.objectContaining({
          seller: expect.objectContaining({
            name: 'DRINK HOUSE',
            pib: '115962350',
          }),
        }),
      );
    });

    it('should number the document with the id and the last two digits of the year', async () => {
      await service.createPdf(40, user);

      expect(pdfService.renderProforma).toHaveBeenCalledWith(
        expect.objectContaining({ documentNumber: '40/26' }),
      );
    });

    it('should print the name from the profile of the company, or the employee when it is not set', async () => {
      await service.createPdf(40, user);
      expect(pdfService.renderProforma).toHaveBeenLastCalledWith(
        expect.objectContaining({ createdByName: 'Milutin' }),
      );

      companiesService.findOne.mockResolvedValue({
        ...company,
        invoiceName: null,
      });
      await service.createPdf(40, user);
      expect(pdfService.renderProforma).toHaveBeenLastCalledWith(
        expect.objectContaining({ createdByName: 'Super Admin' }),
      );
    });

    it('should say what went wrong when the PDF can not be made', async () => {
      pdfService.renderProforma.mockRejectedValue(new Error('font not found'));

      await expect(service.createPdf(40, user)).rejects.toThrow(
        new InternalServerErrorException(
          'Could not create the PDF: font not found',
        ),
      );
    });
  });
});
