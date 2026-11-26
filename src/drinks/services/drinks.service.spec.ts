import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { CategoriesService } from '@/categories/services/categories.service';
import { CompaniesService } from '@/companies/services/companies.service';
import { DrinkStockLevel } from '@/drinks/dto/find-drinks.dto';
import { Drink } from '@/drinks/entities/drink.entity';
import { DrinksService } from '@/drinks/services/drinks.service';
import { User } from '@/users/entities/user.entity';
import { ImageOptimizerService } from '@/storage/services/image-optimizer.service';
import { ImagesService } from '@/storage/services/images.service';
import { StorageService } from '@/storage/services/storage.service';
import { WarehousesService } from '@/warehouses/services/warehouses.service';

jest.mock('nestjs-typeorm-paginate', () => ({
  ...jest.requireActual('nestjs-typeorm-paginate'),
  paginate: jest.fn(),
}));

describe('DrinksService', () => {
  let service: DrinksService;
  let drinkRepository: {
    findOne: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
    update: jest.Mock;
  };
  let warehousesService: { findOne: jest.Mock };
  let companiesService: { assertCanAccess: jest.Mock; findOne: jest.Mock };
  let storageService: {
    upload: jest.Mock;
    delete: jest.Mock;
    publicUrl: jest.Mock;
    drinkFolder: jest.Mock;
  };
  let imageOptimizer: { toWebp: jest.Mock };
  let imagesService: { create: jest.Mock; remove: jest.Mock };
  let categoriesService: { findForCompany: jest.Mock };

  const user = { userId: 7, companyId: 1, roles: [] } as unknown as User;
  const query = { page: 1, limit: 10 };

  const storedDrink = (overrides: Partial<Drink> = {}) =>
    ({
      drinkId: 3,
      code: '352',
      name: 'FANTA 1.5L',
      companyId: 1,
      warehouseId: 5,
      warningQuantity: 12,
      criticalQuantity: 5,
      ...overrides,
    }) as Drink;

  const dto = {
    code: '352',
    name: 'FANTA 1.5L',
    price: 153,
    quantity: 24,
    warehouseId: 5,
  };

  beforeEach(async () => {
    drinkRepository = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((entity: Partial<Drink>) => ({ ...entity })),
      save: jest.fn((entity: Partial<Drink>) => Promise.resolve(entity)),
      softDelete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    warehousesService = {
      findOne: jest.fn().mockResolvedValue({ warehouseId: 5, companyId: 1 }),
    };
    companiesService = {
      assertCanAccess: jest.fn(),
      findOne: jest.fn().mockResolvedValue({ companyId: 1, name: 'KNEZ BAR' }),
    };
    storageService = {
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      publicUrl: jest.fn((key: string | null) =>
        key ? `https://cdn.test/${key}` : null,
      ),
      drinkFolder: jest
        .fn()
        .mockReturnValue('local/company-knez-bar-1/drinks/3'),
    };
    imagesService = {
      create: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    imageOptimizer = {
      toWebp: jest.fn().mockResolvedValue(Buffer.from('webp')),
    };
    categoriesService = {
      findForCompany: jest.fn((ids: number[]) =>
        Promise.resolve(ids.map((categoryId) => ({ categoryId }))),
      ),
    };
    (paginate as jest.Mock)
      .mockReset()
      .mockResolvedValue({ items: [], meta: {} });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrinksService,
        { provide: getRepositoryToken(Drink), useValue: drinkRepository },
        { provide: WarehousesService, useValue: warehousesService },
        { provide: CompaniesService, useValue: companiesService },
        { provide: StorageService, useValue: storageService },
        { provide: ImageOptimizerService, useValue: imageOptimizer },
        { provide: ImagesService, useValue: imagesService },
        { provide: CategoriesService, useValue: categoriesService },
      ],
    }).compile();

    service = module.get(DrinksService);
  });

  describe('findAll', () => {
    const whereOf = () => (paginate as jest.Mock).mock.calls[0][2].where;

    it('should return the drinks of the company of the user sorted by name', async () => {
      await service.findAll(user, query);

      expect(paginate).toHaveBeenCalledWith(
        drinkRepository,
        query,
        expect.objectContaining({
          where: { companyId: 1 },
          order: { name: 'ASC', drinkId: 'ASC' },
        }),
      );
    });

    it('should find nothing for a user without a company', async () => {
      await service.findAll(
        { ...user, companyId: null } as unknown as User,
        query,
      );

      expect(whereOf()).toEqual({ companyId: -1 });
    });

    it("should only return the drinks of one warehouse after checking it is the user's", async () => {
      await service.findAll(user, { ...query, warehouseId: 5 });

      expect(warehousesService.findOne).toHaveBeenCalledWith(5, user);
      expect(whereOf()).toEqual({ warehouseId: 5 });
    });

    it('should not return the drinks of a warehouse of another company', async () => {
      warehousesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(
        service.findAll(user, { ...query, warehouseId: 9 }),
      ).rejects.toThrow(ForbiddenException);
      expect(paginate).not.toHaveBeenCalled();
    });

    it('should load the categories of every drink', async () => {
      await service.findAll(user, query);

      expect((paginate as jest.Mock).mock.calls[0][2].relations).toEqual({
        categories: true,
      });
    });

    it('should filter by several categories (any of them), also together with a search', async () => {
      await service.findAll(user, {
        ...query,
        categoryIds: [3, 4],
        search: 'fanta',
      });

      expect(whereOf()).toHaveLength(2);
      for (const where of whereOf()) {
        expect(where.companyId).toBe(1);
        expect(where.drinkId.getSql('"drink_id"')).toContain(
          '"drink_categories" WHERE "category_id" IN (:...categoryIds)',
        );
        expect(where.drinkId.objectLiteralParameters).toEqual({
          categoryIds: [3, 4],
        });
      }
    });

    it('should not filter by an empty list of categories', async () => {
      await service.findAll(user, { ...query, categoryIds: [] });

      expect(whereOf()).toEqual({ companyId: 1 });
    });

    it('should search the name and the code', async () => {
      await service.findAll(user, { ...query, search: 'fanta' });

      expect(whereOf()).toHaveLength(2);
      expect(whereOf()[0]).toHaveProperty('name');
      expect(whereOf()[1]).toHaveProperty('code');
    });

    it('should filter the critical drinks', async () => {
      await service.findAll(user, {
        ...query,
        stockLevel: DrinkStockLevel.CRITICAL,
      });

      expect(whereOf()).toEqual({ companyId: 1, quantity: expect.anything() });
    });

    it('should filter the drinks with a warning', async () => {
      await service.findAll(user, {
        ...query,
        stockLevel: DrinkStockLevel.WARNING,
      });

      expect(whereOf()).toEqual({ companyId: 1, quantity: expect.anything() });
    });

    it('should write the SQL of the critical level: below zero, or below the critical quantity when it is on', async () => {
      await service.findAll(user, {
        ...query,
        stockLevel: DrinkStockLevel.CRITICAL,
      });

      const sql = whereOf().quantity.getSql('"quantity"') as string;
      expect(sql).toContain('"quantity" < 0');
      expect(sql).toContain('"critical_quantity" > 0');
    });

    it('should write the SQL of the warning level so a critical drink is not in it', async () => {
      await service.findAll(user, {
        ...query,
        stockLevel: DrinkStockLevel.WARNING,
      });

      const sql = whereOf().quantity.getSql('"quantity"') as string;
      expect(sql).toContain('"quantity" >= 0');
      expect(sql).toContain('"warning_quantity" > 0');
      expect(sql).toContain(
        '"critical_quantity" = 0 OR "quantity" >= "critical_quantity"',
      );
    });
  });

  describe('findOne', () => {
    it('should return the drink', async () => {
      const found = storedDrink();
      drinkRepository.findOne.mockResolvedValue(found);

      await expect(service.findOne(3, user)).resolves.toBe(found);
      expect(companiesService.assertCanAccess).toHaveBeenCalledWith(user, 1);
    });

    it('should throw NotFoundException when there is no such drink', async () => {
      drinkRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(99, user)).rejects.toThrow(
        new NotFoundException('Drink not found'),
      );
    });

    it('should not check the company when it is called without a user', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());

      await service.findOne(3);

      expect(companiesService.assertCanAccess).not.toHaveBeenCalled();
    });

    it('should not return the drink of another company', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.findOne(3, user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('should save the drink in the company of its warehouse', async () => {
      const result = await service.create(dto, user);

      expect(warehousesService.findOne).toHaveBeenCalledWith(5, user);
      expect(drinkRepository.create).toHaveBeenCalledWith({
        ...dto,
        companyId: 1,
        categories: [],
      });
      expect(result).toEqual(
        expect.objectContaining({ code: '352', companyId: 1 }),
      );
    });

    it('should put the drink in the sent categories of its company', async () => {
      await service.create({ ...dto, categoryIds: [2, 4] }, user);

      expect(categoriesService.findForCompany).toHaveBeenCalledWith([2, 4], 1);
      expect(drinkRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: [{ categoryId: 2 }, { categoryId: 4 }],
        }),
      );
      expect(drinkRepository.create.mock.calls[0][0]).not.toHaveProperty(
        'categoryIds',
      );
    });

    it('should not save a drink with a category of another company', async () => {
      categoriesService.findForCompany.mockRejectedValue(
        new BadRequestException(),
      );

      await expect(
        service.create({ ...dto, categoryIds: [99] }, user),
      ).rejects.toThrow(BadRequestException);
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });

    it('should not add a drink to a warehouse of another company', async () => {
      warehousesService.findOne.mockRejectedValue(new ForbiddenException());

      await expect(service.create(dto, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the article code is taken in the company', async () => {
      drinkRepository.exists.mockResolvedValue(true);

      await expect(service.create(dto, user)).rejects.toThrow(
        new ConflictException('A drink with this article code already exists.'),
      );
      expect(drinkRepository.exists).toHaveBeenCalledWith({
        where: { code: '352', companyId: 1 },
      });
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when the critical level is not below the warning level', async () => {
      await expect(
        service.create(
          { ...dto, warningQuantity: 5, criticalQuantity: 5 },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(
          { ...dto, warningQuantity: 5, criticalQuantity: 8 },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });

    it('should accept a critical level below the warning level', async () => {
      await expect(
        service.create(
          { ...dto, warningQuantity: 12, criticalQuantity: 5 },
          user,
        ),
      ).resolves.toBeDefined();
    });

    it('should accept a level that is off (0)', async () => {
      await expect(
        service.create(
          { ...dto, warningQuantity: 0, criticalQuantity: 0 },
          user,
        ),
      ).resolves.toBeDefined();
      await expect(
        service.create(
          { ...dto, warningQuantity: 12, criticalQuantity: 0 },
          user,
        ),
      ).resolves.toBeDefined();
    });

    it('should not accept only a critical level, because the warning level is then 0 (off)', async () => {
      await expect(
        service.create({ ...dto, criticalQuantity: 5 }, user),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());
    });

    it('should change the fields that were sent', async () => {
      const result = await service.update(
        3,
        { name: 'FANTA 2L', price: 200 },
        user,
      );

      expect(result).toEqual(
        expect.objectContaining({ name: 'FANTA 2L', price: 200, code: '352' }),
      );
    });

    it('should replace the categories when they are sent', async () => {
      drinkRepository.findOne.mockResolvedValue(
        storedDrink({ categories: [{ categoryId: 1 }] as Drink['categories'] }),
      );

      const result = await service.update(3, { categoryIds: [5] }, user);

      expect(categoriesService.findForCompany).toHaveBeenCalledWith([5], 1);
      expect(result.categories).toEqual([{ categoryId: 5 }]);
      expect(result).not.toHaveProperty('categoryIds');
    });

    it('should keep the categories when they are not sent', async () => {
      drinkRepository.findOne.mockResolvedValue(
        storedDrink({ categories: [{ categoryId: 1 }] as Drink['categories'] }),
      );

      const result = await service.update(3, { name: 'FANTA 2L' }, user);

      expect(categoriesService.findForCompany).not.toHaveBeenCalled();
      expect(result.categories).toEqual([{ categoryId: 1 }]);
    });

    it('should remove all the categories with an empty list', async () => {
      drinkRepository.findOne.mockResolvedValue(
        storedDrink({ categories: [{ categoryId: 1 }] as Drink['categories'] }),
      );

      const result = await service.update(3, { categoryIds: [] }, user);

      expect(result.categories).toEqual([]);
    });

    it('should not check the code when it did not change', async () => {
      await service.update(3, { code: '352' }, user);

      expect(drinkRepository.exists).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the new code is taken', async () => {
      drinkRepository.exists.mockResolvedValue(true);

      await expect(service.update(3, { code: '400' }, user)).rejects.toThrow(
        ConflictException,
      );
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });

    it('should check the levels together with the ones the drink already has', async () => {
      // the drink has the warning level 12, a critical level of 12 is not below it
      await expect(
        service.update(3, { criticalQuantity: 12 }, user),
      ).rejects.toThrow(BadRequestException);
      // the drink has the critical level 5, a warning level of 5 is not above it
      await expect(
        service.update(3, { warningQuantity: 5 }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not change the drink of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.update(3, { name: 'X' }, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(drinkRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete the drink', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());

      await expect(service.remove(3, user)).resolves.toBe(true);
      expect(drinkRepository.softDelete).toHaveBeenCalledWith({ drinkId: 3 });
    });

    it('should throw NotFoundException when there is no such drink', async () => {
      drinkRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(99, user)).rejects.toThrow(NotFoundException);
      expect(drinkRepository.softDelete).not.toHaveBeenCalled();
    });
  });
  describe('images', () => {
    const file = { buffer: Buffer.from('jpg') } as Express.Multer.File;
    const optimized = { buffer: Buffer.from('webp'), width: 800, height: 600 };

    beforeEach(() => {
      imageOptimizer.toWebp.mockResolvedValue(optimized);
      imagesService.create.mockResolvedValue({
        imageId: 9,
        key: 'local/new.webp',
        url: 'https://cdn.test/local/new.webp',
      });
    });

    it('should save the image in the folder of the drink and link it to the drink', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());

      const result = await service.setImage(3, file, user);

      expect(imageOptimizer.toWebp).toHaveBeenCalledWith(file.buffer);
      expect(imagesService.create).toHaveBeenCalledWith({
        companyId: 1,
        folder: 'local/company-knez-bar-1/drinks/3',
        image: optimized,
        altText: 'FANTA 1.5L',
      });
      expect(drinkRepository.update).toHaveBeenCalledWith(
        { drinkId: 3 },
        { imageId: 9 },
      );
      expect(result.image?.url).toBe('https://cdn.test/local/new.webp');
      expect(imagesService.remove).not.toHaveBeenCalled();
    });

    it('should use the given alt text', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());

      await service.setImage(3, file, user, 'Orange soda');

      expect(imagesService.create).toHaveBeenCalledWith(
        expect.objectContaining({ altText: 'Orange soda' }),
      );
    });

    it('should delete the old image when it is replaced', async () => {
      const old = { imageId: 4, key: 'local/old.webp' };
      drinkRepository.findOne.mockResolvedValue(
        storedDrink({ image: old as Drink['image'] }),
      );

      await service.setImage(3, file, user);

      expect(imagesService.remove).toHaveBeenCalledWith(old);
    });

    it('should delete the new image when the database fails', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink());
      drinkRepository.update.mockRejectedValue(new Error('db'));

      await expect(service.setImage(3, file, user)).rejects.toThrow('db');
      expect(imagesService.remove).toHaveBeenCalledWith(
        expect.objectContaining({ imageId: 9 }),
      );
    });

    it('should reject a request without a file', async () => {
      await expect(
        service.setImage(3, undefined as unknown as Express.Multer.File, user),
      ).rejects.toThrow(BadRequestException);
      expect(imagesService.create).not.toHaveBeenCalled();
    });

    it('should not touch the image of a drink of another company', async () => {
      drinkRepository.findOne.mockResolvedValue(storedDrink({ companyId: 2 }));
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.setImage(3, file, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(imagesService.create).not.toHaveBeenCalled();
    });

    it('should remove the image', async () => {
      const image = { imageId: 4, key: 'local/a.webp' };
      drinkRepository.findOne.mockResolvedValue(
        storedDrink({ image: image as Drink['image'] }),
      );

      const result = await service.removeImage(3, user);

      expect(drinkRepository.update).toHaveBeenCalledWith(
        { drinkId: 3 },
        { imageId: null },
      );
      expect(imagesService.remove).toHaveBeenCalledWith(image);
      expect(result.image).toBeNull();
    });
  });
});
