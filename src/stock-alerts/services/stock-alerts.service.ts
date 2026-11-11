import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '@/companies/entities/company.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { CompaniesService } from '@/companies/services/companies.service';
import { MailerService } from '@/mailer/services/mailer.service';
import { StockDigestItem } from '@/mailer/dto';
import { getStockLevel } from '@/stock-alerts/stock.helpers';

export type StockDigestResult = {
  critical: number;
  warning: number;
  recipients: number;
};

/**
 * Twice a day (8:00 and 15:00, Belgrade time) every employee gets one email with
 * everything that is low right now: what has to be bought again (red) and what only
 * has a warning (orange). Nothing is sent when nothing is low.
 */
@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  constructor(
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly companiesService: CompaniesService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 8,15 * * *', {
    name: 'stock-digest',
    timeZone: 'Europe/Belgrade',
  })
  async handleSchedule() {
    if (!this.isScheduleEnabled()) {
      return;
    }

    await this.sendDigestToAllCompanies();
  }

  /**
   * Runs on the server of production. Locally it would send real emails to the people
   * in the database, so there it is off unless STOCK_DIGEST=true.
   * STOCK_DIGEST=false turns it off everywhere.
   */
  private isScheduleEnabled() {
    const setting = this.configService
      .get<string>('STOCK_DIGEST')
      ?.trim()
      .toLowerCase();

    if (setting === 'true') return true;
    if (setting === 'false') return false;

    return (
      this.configService.get<string>('ENVIROMENT')?.trim().toLowerCase() ===
      'production'
    );
  }

  async sendDigestToAllCompanies() {
    const companies = await this.companyRepository.find();

    for (const company of companies) {
      try {
        await this.sendDigest(company.companyId);
      } catch (error) {
        // one company must not stop the others
        this.logger.error(
          `Could not send the stock digest of company ${company.companyId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Sends the overview of one company to all its employees.
   * No email when nothing is low.
   */
  async sendDigest(companyId: number): Promise<StockDigestResult> {
    const drinks = await this.drinkRepository.find({
      where: { companyId },
      relations: ['warehouse'],
      order: { name: 'ASC' },
    });

    const critical: StockDigestItem[] = [];
    const warning: StockDigestItem[] = [];

    for (const drink of drinks) {
      const level = getStockLevel(drink);

      if (level === 'ok') continue;

      const item: StockDigestItem = {
        name: drink.name,
        code: drink.code ?? '',
        warehouseName: drink.warehouse?.name ?? '',
        quantity: drink.quantity,
        threshold:
          level === 'critical' ? drink.criticalQuantity : drink.warningQuantity,
      };

      (level === 'critical' ? critical : warning).push(item);
    }

    // the emptiest first, that is what has to be bought first
    const emptiestFirst = (a: StockDigestItem, b: StockDigestItem) =>
      a.quantity - b.quantity || a.name.localeCompare(b.name);

    critical.sort(emptiestFirst);
    warning.sort(emptiestFirst);

    if (!critical.length && !warning.length) {
      return { critical: 0, warning: 0, recipients: 0 };
    }

    const users = await this.companiesService.findUsers(companyId);
    const recipients = users
      .filter((user) => !!user.email)
      .map((user) => ({
        address: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        language: user.language,
      }));

    const sent = recipients.length
      ? await this.mailerService.sendStockDigestMail({
          recipients,
          critical,
          warning,
        })
      : 0;

    return {
      critical: critical.length,
      warning: warning.length,
      recipients: sent,
    };
  }
}
