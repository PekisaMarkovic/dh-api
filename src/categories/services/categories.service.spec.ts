import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category } from '@/categories/entities/category.entity';
import { CategoriesService } from '@/categories/services/categories.service';
import { CompaniesService } from '@/companies/services/companies.service';
import { User } from '@/users/entities/user.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    manager: { createQueryBuilder: jest.Mock; transaction: jest.Mock };
  };
  let companiesService: { assertCanAccess: jest.Mock };
  // the query of the numbers of drinks per category
  let countQuery: Record<string, jest.Mock>;
  // the queries inside the transaction of remove
  let deleteQuery: Record<string, jest.Mock>;
  let softDelete: jest.Mock;

  const user = { userId: 7, companyId: 1, roles: [] } as unknown as User;

  const category = (overrides: Partial<Category> = {}) =>
    ({ categoryId: 3, name: 'Pivo', companyId: 1, ...overrides }) as Category;

  beforeEach(async () => {
    countQuery = {};
    for (const method of [
      'select',
      'addSelect',
      'from',
      'innerJoin',
      'where',
      'groupBy',
    ]) {
      countQuery[method] = jest.fn().mockReturnValue(countQuery);
    }
    countQuery.getRawMany = jest.fn().mockResolvedValue([]);

    deleteQuery = {};
    for (const method of ['delete', 'from', 'where']) {
      deleteQuery[method] = jest.fn().mockReturnValue(deleteQuery);
    }
    deleteQuery.execute = jest.fn().mockResolvedValue(undefined);
    softDelete = jest.fn().mockResolvedValue(undefined);

    categoryRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((entity: Partial<Category>) => entity),
      save: jest.fn((entity: Partial<Category>) => Promise.resolve(entity)),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(countQuery),
        transaction: jest.fn((callback: (manager: unknown) => unknown) =>
          callback({
            createQueryBuilder: () => deleteQuery,
            getRepository: () => ({ softDelete }),
          }),
        ),
      },
    };
    companiesService = { assertCanAccess: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
        { provide: CompaniesService, useValue: companiesService },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  describe('findAll', () => {
    it('should return the categories of the company of the user by name, with the number of their drinks', async () => {
      categoryRepository.find.mockResolvedValue([
        category({ categoryId: 1, name: 'Pivo' }),
        category({ categoryId: 2, name: 'Vino' }),
      ]);
      countQuery.getRawMany.mockResolvedValue([
        { categoryId: 1, drinksCount: '12' },
      ]);

      const result = await service.findAll(user);

      expect(categoryRepository.find).toHaveBeenCalledWith({
        where: { companyId: 1 },
        order: { name: 'ASC', categoryId: 'ASC' },
      });
      expect(result.map((c) => [c.name, c.drinksCount])).toEqual([
        ['Pivo', 12],
        ['Vino', 0],
      ]);
    });

    it('should not count the deleted drinks', async () => {
      categoryRepository.find.mockResolvedValue([category()]);

      await service.findAll(user);

      expect(countQuery.innerJoin).toHaveBeenCalledWith(
        'drinks',
        'd',
        expect.stringContaining('d.deleted_at IS NULL'),
      );
    });

    it('should not ask for the counts when the company has no categories', async () => {
      await expect(service.findAll(user)).resolves.toEqual([]);
      expect(countQuery.getRawMany).not.toHaveBeenCalled();
    });

    it('should return nothing for a user without a company', async () => {
      const result = await service.findAll({
        ...user,
        companyId: null,
      } as unknown as User);

      expect(result).toEqual([]);
      expect(categoryRepository.find).not.toHaveBeenCalled();
    });

    it('should not return the categories of another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.findAll(user, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findWithDrinks', () => {
    it('should leave out the categories without drinks', async () => {
      categoryRepository.find.mockResolvedValue([
        category({ categoryId: 1, name: 'Pivo' }),
        category({ categoryId: 2, name: 'Vino' }),
      ]);
      countQuery.getRawMany.mockResolvedValue([
        { categoryId: 2, drinksCount: '3' },
      ]);

      const result = await service.findWithDrinks(1);

      expect(result.map((c) => c.name)).toEqual(['Vino']);
    });
  });

  describe('findForCompany', () => {
    it('should return the categories of the company', async () => {
      categoryRepository.find.mockResolvedValue([
        category({ categoryId: 1 }),
        category({ categoryId: 2 }),
      ]);

      await expect(service.findForCompany([1, 2], 1)).resolves.toHaveLength(2);
    });

    it('should throw BadRequestException when one is missing or of another company', async () => {
      categoryRepository.find.mockResolvedValue([category({ categoryId: 1 })]);

      await expect(service.findForCompany([1, 99], 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not ask the database for an empty list', async () => {
      await expect(service.findForCompany([], 1)).resolves.toEqual([]);
      expect(categoryRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should save the category in the company of the user', async () => {
      const result = await service.create({ name: 'Pivo' }, user);

      expect(companiesService.assertCanAccess).toHaveBeenCalledWith(user, 1);
      expect(result).toEqual({ name: 'Pivo', companyId: 1, slug: 'pivo' });
    });

    it('should make the slug from the name, without diacritics', async () => {
      const result = await service.create({ name: 'Točeno pivo' }, user);

      expect(result.slug).toBe('toceno-pivo');
    });

    it('should add a number to a slug that another category of the company has', async () => {
      categoryRepository.find.mockResolvedValue([
        category({ categoryId: 1, slug: 'pivo' }),
        category({ categoryId: 2, slug: 'pivo-2' }),
      ]);

      const result = await service.create({ name: 'Pivo!' }, user);

      expect(result.slug).toBe('pivo-3');
    });

    it('should throw ConflictException when the company already has the name (any case)', async () => {
      categoryRepository.exists.mockResolvedValue(true);

      await expect(service.create({ name: 'pivo' }, user)).rejects.toThrow(
        ConflictException,
      );
      const { name } = categoryRepository.exists.mock.calls[0][0].where;
      expect(name.getSql('"name"')).toBe('LOWER("name") = LOWER(:name)');
      expect(categoryRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when there is no company', async () => {
      await expect(
        service.create({ name: 'Pivo' }, {
          ...user,
          companyId: null,
        } as unknown as User),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not create a category in another company', async () => {
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(
        service.create({ name: 'Pivo', companyId: 2 }, user),
      ).rejects.toThrow(ForbiddenException);
      expect(categoryRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => categoryRepository.findOne.mockResolvedValue(category()));

    it('should rename the category and make its new slug', async () => {
      const result = await service.update(3, { name: 'Piva' }, user);

      expect(result.name).toBe('Piva');
      expect(result.slug).toBe('piva');
    });

    it('should keep the slug the category has itself', async () => {
      categoryRepository.find.mockResolvedValue([
        category({ categoryId: 3, slug: 'piva' }),
      ]);

      const result = await service.update(3, { name: 'Piva' }, user);

      expect(result.slug).toBe('piva');
    });

    it('should not compare the name with the category itself', async () => {
      await service.update(3, { name: 'PIVO' }, user);

      expect(categoryRepository.exists.mock.calls[0][0].where).toHaveProperty(
        'categoryId',
      );
    });

    it('should throw NotFoundException when there is no such category', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.update(9, { name: 'Piva' }, user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should take the drinks out of the category and soft delete it', async () => {
      categoryRepository.findOne.mockResolvedValue(category());

      await service.remove(3, user);

      expect(deleteQuery.from).toHaveBeenCalledWith('drink_categories');
      expect(deleteQuery.where).toHaveBeenCalledWith(
        'category_id = :categoryId',
        { categoryId: 3 },
      );
      expect(softDelete).toHaveBeenCalledWith({ categoryId: 3 });
    });

    it('should not delete the category of another company', async () => {
      categoryRepository.findOne.mockResolvedValue(category({ companyId: 2 }));
      companiesService.assertCanAccess.mockImplementation(() => {
        throw new ForbiddenException();
      });

      await expect(service.remove(3, user)).rejects.toThrow(ForbiddenException);
      expect(softDelete).not.toHaveBeenCalled();
    });
  });
});
