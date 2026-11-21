import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StockAlertsController } from '@/stock-alerts/controllers/stock-alerts.controller';
import { StockAlertsService } from '@/stock-alerts/services/stock-alerts.service';
import { User } from '@/users/entities/user.entity';

describe('StockAlertsController', () => {
  let controller: StockAlertsController;
  let service: { sendDigest: jest.Mock };

  beforeEach(async () => {
    service = { sendDigest: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockAlertsController],
      providers: [{ provide: StockAlertsService, useValue: service }],
    }).compile();

    controller = module.get(StockAlertsController);
  });

  it('should send the digest of the company of the user now', async () => {
    service.sendDigest.mockResolvedValue({
      critical: 1,
      warning: 0,
      recipients: 2,
    });

    await expect(controller.sendNow({ companyId: 1 } as User)).resolves.toEqual(
      {
        critical: 1,
        warning: 0,
        recipients: 2,
      },
    );
    expect(service.sendDigest).toHaveBeenCalledWith(1);
  });

  it('should throw BadRequestException when the user is not in a company', () => {
    expect(() =>
      controller.sendNow({ companyId: null } as unknown as User),
    ).toThrow(BadRequestException);
    expect(service.sendDigest).not.toHaveBeenCalled();
  });
});
