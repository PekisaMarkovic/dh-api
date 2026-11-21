import { Test, TestingModule } from '@nestjs/testing';
import { ADMINS, rolesOf } from '@/common/testing/controller.helpers';
import { PurchaseImportController } from '@/purchase-import/controllers/purchase-import.controller';
import { PurchaseImportService } from '@/purchase-import/services/purchase-import.service';
import { User } from '@/users/entities/user.entity';

describe('PurchaseImportController', () => {
  let controller: PurchaseImportController;
  let service: {
    parse: jest.Mock;
    apply: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };

  const user = { userId: 7, companyId: 1 } as User;

  beforeEach(async () => {
    service = {
      parse: jest.fn(),
      apply: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseImportController],
      providers: [{ provide: PurchaseImportService, useValue: service }],
    }).compile();

    controller = module.get(PurchaseImportController);
  });

  it('should read the uploaded file for the warehouse of the request', async () => {
    const file = { originalname: 'petar.pdf' } as Express.Multer.File;
    service.parse.mockResolvedValue({ purchaseImportId: 10 });

    await expect(
      controller.parse({ warehouseId: 5 }, file, user),
    ).resolves.toEqual({
      purchaseImportId: 10,
    });
    expect(service.parse).toHaveBeenCalledWith(5, file, user);
  });

  it('should add the checked lines to the stock', async () => {
    const dto = {
      purchaseImportId: 10,
      items: [{ purchaseImportItemId: 1, drinkId: 128, quantity: 2 }],
    };
    service.apply.mockResolvedValue({ updated: 1 });

    await expect(controller.apply(dto, user)).resolves.toEqual({ updated: 1 });
    expect(service.apply).toHaveBeenCalledWith(dto, user);
  });

  it('should return a page of the history', async () => {
    const query = { page: 2, limit: 10, search: 'zurka' };
    service.findAll.mockResolvedValue({ items: [] });

    await controller.findAll(user, query);

    expect(service.findAll).toHaveBeenCalledWith(user, query);
  });

  it('should return one document', async () => {
    service.findOne.mockResolvedValue({ purchaseImportId: 10 });

    await expect(controller.findOne(10, user)).resolves.toEqual({
      purchaseImportId: 10,
    });
    expect(service.findOne).toHaveBeenCalledWith(10, user);
  });

  it('should remove a document from the history', async () => {
    service.remove.mockResolvedValue(true);

    await expect(controller.remove(10, user)).resolves.toBe(true);
    expect(service.remove).toHaveBeenCalledWith(10, user);
  });

  describe('who can do what', () => {
    it('should let only admins use the whole controller', () => {
      expect(rolesOf(PurchaseImportController)).toEqual(ADMINS);
    });
  });
});
