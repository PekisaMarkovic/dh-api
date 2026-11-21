import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ADMINS, rolesOf } from '@/common/testing/controller.helpers';
import { ProformasController } from '@/proformas/controllers/proformas.controller';
import { ProformasService } from '@/proformas/services/proformas.service';
import { User } from '@/users/entities/user.entity';

describe('ProformasController', () => {
  let controller: ProformasController;
  let service: Record<
    'findAll' | 'findOne' | 'createPdf' | 'create' | 'update' | 'returnToStock',
    jest.Mock
  >;

  const user = { userId: 7, companyId: 1 } as User;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      createPdf: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      returnToStock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProformasController],
      providers: [{ provide: ProformasService, useValue: service }],
    }).compile();

    controller = module.get(ProformasController);
  });

  it('should return a page of the proformas', async () => {
    const query = { page: 1, limit: 10, search: 'PR-000012' };

    await controller.findAll(user, query);

    expect(service.findAll).toHaveBeenCalledWith(user, query);
  });

  it('should return one proforma', async () => {
    await controller.findOne(40, user);

    expect(service.findOne).toHaveBeenCalledWith(40, user);
  });

  it('should return the PDF as a download with the name of the proforma', async () => {
    service.createPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF'),
      filename: 'PR-000040.pdf',
    });

    const file = await controller.downloadPdf(40, user);

    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.options).toEqual(
      expect.objectContaining({
        type: 'application/pdf',
        disposition: 'attachment; filename="PR-000040.pdf"',
      }),
    );
  });

  it('should create a proforma', async () => {
    const dto = { warehouseId: 5, items: [{ drinkId: 1, quantity: 2 }] };

    await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it('should update a proforma', async () => {
    const dto = { items: [{ drinkId: 1, quantity: 3 }] };

    await controller.update(40, dto, user);

    expect(service.update).toHaveBeenCalledWith(40, dto, user);
  });

  it('should return a proforma to the stock', async () => {
    await controller.returnToStock(40, user);

    expect(service.returnToStock).toHaveBeenCalledWith(40, user);
  });

  describe('who can do what', () => {
    it.each(['update', 'returnToStock'] as const)(
      'should let only admins call %s',
      (method) => {
        expect(rolesOf(ProformasController.prototype[method])).toEqual(ADMINS);
      },
    );

    it.each(['findAll', 'findOne', 'downloadPdf', 'create'] as const)(
      'should let every logged in user call %s',
      (method) => {
        expect(rolesOf(ProformasController.prototype[method])).toBeUndefined();
      },
    );
  });
});
