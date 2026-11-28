import { createHash } from 'crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { AiService } from '@/ai/ai.service';
import { AI_MODEL } from '@/ai/ai.constants';
import { CompaniesService } from '@/companies/services/companies.service';
import { Drink } from '@/drinks/entities/drink.entity';
import { PurchaseImport } from '@/purchase-import/entities/purchase-import.entity';
import { PurchaseImportItem } from '@/purchase-import/entities/purchase-import-item.entity';
import { PurchaseImportStatusEnums } from '@/purchase-import/enums/purchase-import-status.enum';
import { PurchaseImportService } from '@/purchase-import/services/purchase-import.service';
import { User } from '@/users/entities/user.entity';
import { WarehousesService } from '@/warehouses/services/warehouses.service';

jest.mock('nestjs-typeorm-paginate', () => ({
  ...jest.requireActual('nestjs-typeorm-paginate'),
  paginate: jest.fn(),
}));

describe('PurchaseImportService', () => {
  let service: PurchaseImportService;
  let drinkRepository: { find: jest.Mock };
  let importRepository: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    softDelete: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let itemRepository: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  // the manager of the transaction of apply
  let manager: { find: jest.Mock; increment: jest.Mock; update: jest.Mock };
  let warehousesService: { findOne: jest.Mock };
  let companiesService: { assertCanAccess: jest.Mock };
  let aiService: { extractPurchaseItems: jest.Mock };

  const user = { userId: 7, companyId: 1, roles: [] } as unknown as User;

  const file = {
    originalname: 'petar.pdf',
    mimetype: 'application/pdf',
    size: 4,
    buffer: Buffer.from('%PDF'),
  } as Express.Multer.File;

  const drinks = [
    { drinkId: 128, name: 'FANTA 1.5L' },
    { drinkId: 2, name: 'TUBORG 0.33L' },
  ];

  beforeEach(async () => {
    drinkRepository = { find: jest.fn().mockResolvedValue(drinks) };
    manager = { find: jest.fn(), increment: jest.fn(), update: jest.fn() };
    importRepository = {
      create: jest.fn((entity: Partial<PurchaseImport>) => entity),
      save: jest.fn((entity: Partial<PurchaseImport>) =>
        Promise.resolve({ ...entity, purchaseImportId: 10 }),
      ),
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      softDelete: jest.fn().mockResolvedValue(undefined),
      manager: {
        transaction: jest.fn((callback: (manager: unknown) => unknown) =>
          callback(manager),
        ),
      },
    };
    itemRepository = {
      create: jest.fn((entity: Partial<PurchaseImportItem>) => entity),
      save: jest.fn((items: Partial<PurchaseImportItem>[]) =>
        Promise.resolve(
          items.map((item, index) => ({
            ...item,
            purchaseImportItemId: index + 1,
          })),
        ),
      ),
      createQueryBuilder: jest.fn(),
    };
    warehousesService = {
      findOne: jest.fn().mockResolvedValue({ warehouseId: 5, companyId: 1 }),
    };
    companiesService = { assertCanAccess: jest.fn() };
    aiService = { extractPurchaseItems: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseImportService,
        { provide: getRepositoryToken(Drink), useValue: drinkRepository },
        {
          provide: getRepositoryToken(PurchaseImport),
          useValue: importRepository,
        },
        {
          provide: getRepositoryToken(PurchaseImportItem),
          useValue: itemRepository,
        },
        { provide: WarehousesService, useValue: warehousesService },
        { provide: CompaniesService, useValue: companiesService },
        { provide: AiService, useValue: aiService },
      ],
    }).compile();

    service = module.get(PurchaseImportService);
  });

  describe('parse', () => {
    const extraction = {
      title: 'PRIVATNA ZURKA Predracun 40/26',
      items: [
        { name: 'FANTA 1.5L', quantity: 2, drinkId: null },
        { name: 'HENNESSY VS 0.7L', quantity: 1, drinkId: null },
      ],
      raw: { buyerName: 'PRIVATNA ZURKA', items: [] },
    };

    it('should throw BadRequestException when there is no file', async () => {
      await expect(
        service.parse(5, undefined as unknown as Express.Multer.File, user),
      ).rejects.toThrow(new BadRequestException('A file is required'));
    });

    it.each(['text/plain', 'application/zip', 'image/gif'])(
      'should throw BadRequestException for the file type %s',
      async (mimetype) => {
        await expect(
          service.parse(5, { ...file, mimetype }, user),
        ).rejects.toThrow(BadRequestException);
        expect(aiService.extractPurchaseItems).not.toHaveBeenCalled();
      },
    );

    it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])(
      'should accept the file type %s',
      async (mimetype) => {
        aiService.extractPurchaseItems.mockResolvedValue(extraction);

        await expect(
          service.parse(5, { ...file, mimetype }, user),
        ).resolves.toBeDefined();
      },
    );

    it('should not read a document for a warehouse of another company', async () => {
      warehousesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(service.parse(5, file, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(importRepository.save).not.toHaveBeenCalled();
      expect(aiService.extractPurchaseItems).not.toHaveBeenCalled();
    });

    it('should remember the upload without keeping the document', async () => {
      aiService.extractPurchaseItems.mockResolvedValue(extraction);

      await service.parse(5, file, user);

      expect(importRepository.create).toHaveBeenCalledWith({
        companyId: 1,
        warehouseId: 5,
        userId: 7,
        fileName: 'petar.pdf',
        mimeType: 'application/pdf',
        fileSize: 4,
        fileHash: createHash('sha256').update(file.buffer).digest('hex'),
        status: PurchaseImportStatusEnums.PARSING,
        model: AI_MODEL,
      });
      // only the metadata of the file is saved, never its content
      expect(JSON.stringify(importRepository.create.mock.calls)).not.toContain(
        '%PDF',
      );
    });

    it('should save the lines, with the drink matched by the name, and mark the import as read', async () => {
      aiService.extractPurchaseItems.mockResolvedValue(extraction);

      const result = await service.parse(5, file, user);

      expect(itemRepository.create).toHaveBeenCalledWith({
        purchaseImportId: 10,
        nameOnDocument: 'FANTA 1.5L',
        quantity: 2,
        suggestedDrinkId: 128,
      });
      // no drink is similar enough to this name
      expect(itemRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nameOnDocument: 'HENNESSY VS 0.7L',
          suggestedDrinkId: null,
        }),
      );
      expect(importRepository.update).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          status: PurchaseImportStatusEnums.PARSED,
          title: 'PRIVATNA ZURKA Predracun 40/26',
          aiResponse: extraction.raw,
          durationMs: expect.any(Number),
        }),
      );
      expect(result).toEqual({
        purchaseImportId: 10,
        items: [
          {
            purchaseImportItemId: 1,
            name: 'FANTA 1.5L',
            quantity: 2,
            drinkId: 128,
          },
          {
            purchaseImportItemId: 2,
            name: 'HENNESSY VS 0.7L',
            quantity: 1,
            drinkId: null,
          },
        ],
        drinks,
      });
    });

    it('should send the drinks of the warehouse to the AI and take its match first', async () => {
      aiService.extractPurchaseItems.mockResolvedValue({
        ...extraction,
        items: [{ name: 'TUB 0,33 LIM', quantity: 24, drinkId: 2 }],
      });

      await service.parse(5, file, user);

      expect(aiService.extractPurchaseItems).toHaveBeenCalledWith(file, drinks);
      expect(itemRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nameOnDocument: 'TUB 0,33 LIM',
          suggestedDrinkId: 2,
        }),
      );
    });

    it('should not change the stock', async () => {
      aiService.extractPurchaseItems.mockResolvedValue(extraction);

      await service.parse(5, file, user);

      expect(importRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('should save an empty title when the AI found none', async () => {
      aiService.extractPurchaseItems.mockResolvedValue({
        ...extraction,
        title: null,
      });

      await service.parse(5, file, user);

      expect(importRepository.update).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ title: null }),
      );
    });

    it('should remember the failure and throw the error again when the AI fails', async () => {
      const error = new BadGatewayException('The document could not be read');
      aiService.extractPurchaseItems.mockRejectedValue(error);

      await expect(service.parse(5, file, user)).rejects.toBe(error);

      expect(importRepository.update).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          status: PurchaseImportStatusEnums.FAILED,
          errorMessage: 'The document could not be read',
        }),
      );
      expect(itemRepository.save).not.toHaveBeenCalled();
    });

    it('should cut a very long error message', async () => {
      aiService.extractPurchaseItems.mockRejectedValue(
        new Error('x'.repeat(5000)),
      );

      await expect(service.parse(5, file, user)).rejects.toThrow();

      const { errorMessage } = importRepository.update.mock.calls[0][1] as {
        errorMessage: string;
      };
      expect(errorMessage).toHaveLength(2000);
    });
  });

  describe('apply', () => {
    const record = (status = PurchaseImportStatusEnums.PARSED) => ({
      purchaseImportId: 10,
      companyId: 1,
      warehouseId: 5,
      status,
    });
    const dto = {
      purchaseImportId: 10,
      items: [
        { purchaseImportItemId: 1, drinkId: 128, quantity: 2 },
        { purchaseImportItemId: 2, drinkId: 2, quantity: 48 },
      ],
    };
    // the lines of the document that were not added yet
    const freeLines = [
      { purchaseImportItemId: 1, appliedDrinkId: null },
      { purchaseImportItemId: 2, appliedDrinkId: null },
    ];

    beforeEach(() => {
      importRepository.findOne.mockResolvedValue(record());
    });

    it('should throw NotFoundException when there is no such import', async () => {
      importRepository.findOne.mockResolvedValue(null);

      await expect(service.apply(dto, user)).rejects.toThrow(NotFoundException);
    });

    it('should not add the documents of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.apply(dto, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(importRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it.each([
      PurchaseImportStatusEnums.PARSING,
      PurchaseImportStatusEnums.FAILED,
    ])(
      'should throw BadRequestException when the status is %s',
      async (status) => {
        importRepository.findOne.mockResolvedValue(record(status));

        await expect(service.apply(dto, user)).rejects.toThrow(
          new BadRequestException('The document was not read'),
        );
        expect(importRepository.manager.transaction).not.toHaveBeenCalled();
      },
    );

    it('should throw NotFoundException when a drink is not in the warehouse of the document', async () => {
      manager.find.mockResolvedValueOnce([drinks[0]]);

      await expect(service.apply(dto, user)).rejects.toThrow(
        new NotFoundException('A drink is not in this warehouse'),
      );
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when a line is not of the document', async () => {
      manager.find
        .mockResolvedValueOnce(drinks)
        .mockResolvedValueOnce([freeLines[0]]);

      await expect(service.apply(dto, user)).rejects.toThrow(
        new NotFoundException('A line is not of this document'),
      );
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when a line was already added, so the stock is not counted twice', async () => {
      manager.find
        .mockResolvedValueOnce(drinks)
        .mockResolvedValueOnce([
          freeLines[0],
          { purchaseImportItemId: 2, appliedDrinkId: 2 },
        ]);

      await expect(service.apply(dto, user)).rejects.toThrow(
        new ConflictException('A line was already added to the stock'),
      );
      expect(manager.increment).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('should add the quantities to the stock of the drinks', async () => {
      manager.find
        .mockResolvedValueOnce(drinks)
        .mockResolvedValueOnce(freeLines);

      await expect(service.apply(dto, user)).resolves.toEqual({ updated: 2 });

      expect(manager.increment).toHaveBeenCalledWith(
        Drink,
        { drinkId: 128 },
        'quantity',
        2,
      );
      expect(manager.increment).toHaveBeenCalledWith(
        Drink,
        { drinkId: 2 },
        'quantity',
        48,
      );
    });

    it('should remember what was added for every line', async () => {
      manager.find
        .mockResolvedValueOnce(drinks)
        .mockResolvedValueOnce(freeLines);

      await service.apply(dto, user);

      expect(manager.update).toHaveBeenCalledWith(
        PurchaseImportItem,
        { purchaseImportItemId: 1 },
        { appliedDrinkId: 128, appliedQuantity: 2 },
      );
      expect(manager.update).toHaveBeenCalledWith(
        PurchaseImportItem,
        { purchaseImportItemId: 2 },
        { appliedDrinkId: 2, appliedQuantity: 48 },
      );
    });

    it('should mark the import as added', async () => {
      manager.find
        .mockResolvedValueOnce(drinks)
        .mockResolvedValueOnce(freeLines);

      await service.apply(dto, user);

      expect(manager.update).toHaveBeenCalledWith(
        PurchaseImport,
        10,
        expect.objectContaining({
          status: PurchaseImportStatusEnums.APPLIED,
          appliedAt: expect.any(Date),
        }),
      );
    });

    it('should add the same drink from two lines once, with the sum of the quantities', async () => {
      manager.find
        .mockResolvedValueOnce([drinks[0]])
        .mockResolvedValueOnce(freeLines);

      await service.apply(
        {
          purchaseImportId: 10,
          items: [
            { purchaseImportItemId: 1, drinkId: 128, quantity: 2 },
            { purchaseImportItemId: 2, drinkId: 128, quantity: 3 },
          ],
        },
        user,
      );

      expect(manager.increment).toHaveBeenCalledTimes(1);
      expect(manager.increment).toHaveBeenCalledWith(
        Drink,
        { drinkId: 128 },
        'quantity',
        5,
      );
      // both lines are remembered
      expect(manager.update).toHaveBeenCalledTimes(3);
    });

    it('should let the lines that were left out be added later', async () => {
      importRepository.findOne.mockResolvedValue(
        record(PurchaseImportStatusEnums.APPLIED),
      );
      manager.find
        .mockResolvedValueOnce([drinks[1]])
        .mockResolvedValueOnce([freeLines[1]]);

      await expect(
        service.apply(
          {
            purchaseImportId: 10,
            items: [{ purchaseImportItemId: 2, drinkId: 2, quantity: 48 }],
          },
          user,
        ),
      ).resolves.toEqual({ updated: 1 });
    });
  });

  describe('findAll', () => {
    const page = {
      items: [
        {
          purchaseImportId: 10,
          createdAt: new Date('2026-11-21'),
          appliedAt: null,
          title: 'PRIVATNA ZURKA Predracun 40/26',
          fileName: 'petar.pdf',
          fileSize: 4,
          status: PurchaseImportStatusEnums.APPLIED,
          model: AI_MODEL,
          durationMs: 1500,
          errorMessage: null,
          warehouse: { name: 'Magacin 1' },
          user: { firstName: 'Super', lastName: 'Admin' },
        },
        {
          purchaseImportId: 9,
          title: null,
          fileName: 'slika.jpg',
          status: PurchaseImportStatusEnums.FAILED,
          warehouse: null,
          user: null,
        },
      ],
      meta: {
        totalItems: 2,
        itemCount: 2,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      },
    };
    const query = { page: 1, limit: 10 };

    const mockCounts = (rows: unknown[]) => {
      const builder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rows),
      };
      itemRepository.createQueryBuilder.mockReturnValue(builder);

      return builder;
    };

    beforeEach(() => {
      // the calls of the tests before must not be seen
      (paginate as jest.Mock).mockReset().mockResolvedValue(page);
    });

    it('should return the page with the number of the lines and of the added lines', async () => {
      mockCounts([{ purchaseImportId: 10, lines: '4', applied: '3' }]);

      const result = await service.findAll(user, query);

      expect(result.meta).toBe(page.meta);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          purchaseImportId: 10,
          title: 'PRIVATNA ZURKA Predracun 40/26',
          warehouseName: 'Magacin 1',
          userName: 'Super Admin',
          linesCount: 4,
          appliedCount: 3,
        }),
      );
    });

    it('should return zeros and empty names for an import without lines, a warehouse or a user', async () => {
      mockCounts([]);

      const result = await service.findAll(user, query);

      expect(result.items[1]).toEqual(
        expect.objectContaining({
          warehouseName: '',
          userName: '',
          linesCount: 0,
          appliedCount: 0,
        }),
      );
    });

    it('should not return the password or the other data of the user', async () => {
      mockCounts([]);

      const result = await service.findAll(user, query);

      expect(result.items[0]).not.toHaveProperty('user');
      expect(result.items[0]).not.toHaveProperty('warehouse');
    });

    it('should only look at the imports of the company of the user, newest first', async () => {
      mockCounts([]);

      await service.findAll(user, query);

      expect(paginate).toHaveBeenCalledWith(
        importRepository,
        query,
        expect.objectContaining({
          where: { companyId: 1 },
          relations: ['user', 'warehouse'],
          order: { createdAt: 'DESC', purchaseImportId: 'DESC' },
        }),
      );
    });

    it('should search the title and the file name', async () => {
      mockCounts([]);

      await service.findAll(user, { ...query, search: 'zurka' });

      const { where } = (paginate as jest.Mock).mock.calls[0][2] as {
        where: { companyId: number; title?: unknown; fileName?: unknown }[];
      };
      expect(where).toHaveLength(2);
      expect(where[0]).toEqual(
        expect.objectContaining({ companyId: 1, title: expect.anything() }),
      );
      expect(where[1]).toEqual(
        expect.objectContaining({ companyId: 1, fileName: expect.anything() }),
      );
    });

    it('should not count the lines when the page is empty', async () => {
      (paginate as jest.Mock).mockResolvedValue({ items: [], meta: page.meta });

      const result = await service.findAll(user, query);

      expect(result.items).toEqual([]);
      expect(itemRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const detail = {
      purchaseImportId: 10,
      companyId: 1,
      warehouseId: 5,
      title: 'PRIVATNA ZURKA Predracun 40/26',
      fileName: 'petar.pdf',
      mimeType: 'application/pdf',
      status: PurchaseImportStatusEnums.PARSED,
      errorMessage: null,
      createdAt: new Date('2026-11-21'),
      appliedAt: null,
      aiResponse: { items: [] },
      warehouse: { name: 'Magacin 1' },
      user: { firstName: 'Super', lastName: 'Admin', password: 'hash' },
      items: [
        {
          purchaseImportItemId: 2,
          nameOnDocument: 'TUBORG 0.33L',
          quantity: 48,
          suggestedDrinkId: 2,
          appliedDrinkId: null,
          appliedQuantity: null,
        },
        {
          purchaseImportItemId: 1,
          nameOnDocument: 'FANTA 1.5L',
          quantity: 2,
          suggestedDrinkId: 128,
          appliedDrinkId: 128,
          appliedQuantity: 2,
        },
      ],
    };

    beforeEach(() => {
      importRepository.findOne.mockResolvedValue(detail);
    });

    it('should return the lines in the order of the document with the drinks of the warehouse', async () => {
      const result = await service.findOne(10, user);

      expect(result.items.map((item) => item.purchaseImportItemId)).toEqual([
        1, 2,
      ]);
      expect(result.items[0]).toEqual({
        purchaseImportItemId: 1,
        name: 'FANTA 1.5L',
        quantity: 2,
        suggestedDrinkId: 128,
        appliedDrinkId: 128,
        appliedQuantity: 2,
      });
      expect(result.drinks).toEqual(drinks);
      expect(drinkRepository.find).toHaveBeenCalledWith({
        where: { warehouseId: 5 },
        order: { name: 'ASC' },
      });
    });

    it('should return the names of the warehouse and of the user, not the user', async () => {
      const result = await service.findOne(10, user);

      expect(result).toEqual(
        expect.objectContaining({
          warehouseName: 'Magacin 1',
          userName: 'Super Admin',
        }),
      );
      expect(JSON.stringify(result)).not.toContain('hash');
    });

    it('should not return the answer of the AI', async () => {
      const result = await service.findOne(10, user);

      expect(result).not.toHaveProperty('aiResponse');
    });

    it('should throw NotFoundException when there is no such import', async () => {
      importRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(99, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not return the document of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.findOne(10, user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('should remove the document from the history', async () => {
      importRepository.findOne.mockResolvedValue({
        purchaseImportId: 10,
        companyId: 1,
      });

      await expect(service.remove(10, user)).resolves.toBe(true);

      expect(importRepository.softDelete).toHaveBeenCalledWith({
        purchaseImportId: 10,
      });
    });

    it('should not take the stock back', async () => {
      importRepository.findOne.mockResolvedValue({
        purchaseImportId: 10,
        companyId: 1,
      });

      await service.remove(10, user);

      expect(importRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when there is no such import', async () => {
      importRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(99, user)).rejects.toThrow(NotFoundException);
      expect(importRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should not remove the document of another company', async () => {
      importRepository.findOne.mockResolvedValue({
        purchaseImportId: 10,
        companyId: 2,
      });
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.remove(10, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(importRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
