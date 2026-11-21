import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from '@/companies/entities/company.entity';
import { CompaniesService } from '@/companies/services/companies.service';
import { Drink } from '@/drinks/entities/drink.entity';
import { MailerService } from '@/mailer/services/mailer.service';
import { StockAlertsService } from '@/stock-alerts/services/stock-alerts.service';

describe('StockAlertsService', () => {
  let service: StockAlertsService;
  let drinkRepository: { find: jest.Mock };
  let companyRepository: { find: jest.Mock };
  let companiesService: { findUsers: jest.Mock };
  let mailerService: { sendStockDigestMail: jest.Mock };
  let configService: { get: jest.Mock };

  // quantity, warning level, critical level
  const drink = (
    name: string,
    quantity: number,
    warningQuantity = 12,
    criticalQuantity = 5,
    warehouse: { name: string } | null = { name: 'Magacin 1' },
  ) => ({
    name,
    code: '1',
    quantity,
    warningQuantity,
    criticalQuantity,
    warehouse,
  });

  const users = [
    {
      email: 'a@drinkhouse.rs',
      firstName: 'Ana',
      lastName: 'Anic',
      language: 'sr',
    },
    {
      email: 'b@drinkhouse.rs',
      firstName: 'Bojan',
      lastName: '',
      language: 'en',
    },
    { email: '', firstName: 'Bez', lastName: 'Mejla', language: 'sr' },
  ];

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    drinkRepository = { find: jest.fn().mockResolvedValue([]) };
    companyRepository = { find: jest.fn().mockResolvedValue([]) };
    companiesService = { findUsers: jest.fn().mockResolvedValue(users) };
    mailerService = { sendStockDigestMail: jest.fn().mockResolvedValue(2) };
    configService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockAlertsService,
        { provide: getRepositoryToken(Drink), useValue: drinkRepository },
        { provide: getRepositoryToken(Company), useValue: companyRepository },
        { provide: CompaniesService, useValue: companiesService },
        { provide: MailerService, useValue: mailerService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(StockAlertsService);
  });

  describe('handleSchedule', () => {
    it('should send the digest on the server of production', async () => {
      configService.get.mockReturnValue('production');
      companyRepository.find.mockResolvedValue([{ companyId: 1 }]);

      await service.handleSchedule();

      expect(companyRepository.find).toHaveBeenCalled();
    });

    it('should not care about the case or the spaces of the environment name', async () => {
      configService.get.mockReturnValue(' Production ');

      await service.handleSchedule();

      expect(companyRepository.find).toHaveBeenCalled();
    });

    it.each(['development', 'staging', '', undefined])(
      'should not send anything when the environment is %p, so real people get no email from a local server',
      async (environment) => {
        configService.get.mockReturnValue(environment);

        await service.handleSchedule();

        expect(companyRepository.find).not.toHaveBeenCalled();
        expect(mailerService.sendStockDigestMail).not.toHaveBeenCalled();
      },
    );
  });

  describe('sendDigestToAllCompanies', () => {
    it('should send the digest of every company', async () => {
      companyRepository.find.mockResolvedValue([
        { companyId: 1 },
        { companyId: 2 },
      ]);
      drinkRepository.find.mockResolvedValue([drink('FANTA', 2)]);

      await service.sendDigestToAllCompanies();

      expect(drinkRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 1 } }),
      );
      expect(drinkRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 2 } }),
      );
    });

    it('should go on with the other companies when one of them fails', async () => {
      companyRepository.find.mockResolvedValue([
        { companyId: 1 },
        { companyId: 2 },
      ]);
      drinkRepository.find
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce([drink('FANTA', 2)]);

      await expect(service.sendDigestToAllCompanies()).resolves.toBeUndefined();

      expect(mailerService.sendStockDigestMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendDigest', () => {
    it('should look at the drinks of the company with their warehouses', async () => {
      await service.sendDigest(1);

      expect(drinkRepository.find).toHaveBeenCalledWith({
        where: { companyId: 1 },
        relations: ['warehouse'],
        order: { name: 'ASC' },
      });
    });

    it('should send nothing when no drink is low', async () => {
      drinkRepository.find.mockResolvedValue([drink('FANTA', 100)]);

      await expect(service.sendDigest(1)).resolves.toEqual({
        critical: 0,
        warning: 0,
        recipients: 0,
      });
      expect(companiesService.findUsers).not.toHaveBeenCalled();
      expect(mailerService.sendStockDigestMail).not.toHaveBeenCalled();
    });

    it('should separate what has to be bought again (critical) from what has a warning', async () => {
      drinkRepository.find.mockResolvedValue([
        drink('FANTA', 2),
        drink('TUBORG', 8),
        drink('PEPSI', 100),
      ]);

      const result = await service.sendDigest(1);

      expect(result).toEqual({ critical: 1, warning: 1, recipients: 2 });
      const mail = mailerService.sendStockDigestMail.mock.calls[0][0];
      expect(mail.critical).toEqual([
        {
          name: 'FANTA',
          code: '1',
          warehouseName: 'Magacin 1',
          quantity: 2,
          threshold: 5,
        },
      ]);
      expect(mail.warning).toEqual([
        {
          name: 'TUBORG',
          code: '1',
          warehouseName: 'Magacin 1',
          quantity: 8,
          threshold: 12,
        },
      ]);
    });

    it('should put the emptiest drink first, and the names in order when the quantity is the same', async () => {
      drinkRepository.find.mockResolvedValue([
        drink('SPRITE', 3),
        drink('FANTA', 3),
        drink('COCA COLA', -2),
      ]);

      await service.sendDigest(1);

      const { critical } = mailerService.sendStockDigestMail.mock.calls[0][0];
      expect(critical.map((item: { name: string }) => item.name)).toEqual([
        'COCA COLA',
        'FANTA',
        'SPRITE',
      ]);
    });

    it('should send the mail only to the employees that have an email, with the name and the language', async () => {
      drinkRepository.find.mockResolvedValue([drink('FANTA', 2)]);

      await service.sendDigest(1);

      expect(mailerService.sendStockDigestMail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: [
            { address: 'a@drinkhouse.rs', name: 'Ana Anic', language: 'sr' },
            { address: 'b@drinkhouse.rs', name: 'Bojan', language: 'en' },
          ],
        }),
      );
    });

    it('should return the number of mails that were sent', async () => {
      drinkRepository.find.mockResolvedValue([drink('FANTA', 2)]);
      mailerService.sendStockDigestMail.mockResolvedValue(1);

      const result = await service.sendDigest(1);

      expect(result.recipients).toBe(1);
    });

    it('should not send a mail when nobody in the company has an email', async () => {
      drinkRepository.find.mockResolvedValue([drink('FANTA', 2)]);
      companiesService.findUsers.mockResolvedValue([users[2]]);

      const result = await service.sendDigest(1);

      expect(mailerService.sendStockDigestMail).not.toHaveBeenCalled();
      expect(result).toEqual({ critical: 1, warning: 0, recipients: 0 });
    });

    it('should use empty texts for a drink without a warehouse or a code', async () => {
      drinkRepository.find.mockResolvedValue([
        { ...drink('FANTA', 2, 12, 5, null), code: null },
      ]);

      await service.sendDigest(1);

      expect(
        mailerService.sendStockDigestMail.mock.calls[0][0].critical[0],
      ).toEqual(expect.objectContaining({ code: '', warehouseName: '' }));
    });
  });
});
