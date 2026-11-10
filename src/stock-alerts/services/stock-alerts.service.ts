import { Injectable, Logger } from '@nestjs/common';
import { CompaniesService } from '@/companies/services/companies.service';
import { WarehousesService } from '@/warehouses/services/warehouses.service';
import { MailerService } from '@/mailer/services/mailer.service';
import {
  getStockLevel,
  isWorse,
  StockSnapshot,
} from '@/stock-alerts/stock.helpers';

export type StockChange = {
  companyId: number;
  warehouseId: number;
  drinkName: string;
  drinkCode: string | null;
  before: StockSnapshot;
  after: StockSnapshot;
};

/**
 * Tells the employees of a company by email when a drink falls below its warning
 * or its "has to be bought again" quantity.
 */
@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly warehousesService: WarehousesService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Call it after the stock of a drink changed. An email goes out only when the level
   * got worse, so nobody gets the same message again and again.
   * It does not wait for the emails and it never throws: a mail problem must not
   * break what the user was doing (e.g. making a proforma).
   */
  notifyIfWorse(change: StockChange) {
    const before = getStockLevel(change.before);
    const after = getStockLevel(change.after);

    if (after === 'ok' || !isWorse(before, after)) {
      return;
    }

    this.send(change, after).catch((error) =>
      this.logger.error(
        `Could not send the stock alert for "${change.drinkName}": ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  private async send(change: StockChange, level: 'warning' | 'critical') {
    const [users, warehouse] = await Promise.all([
      this.companiesService.findUsers(change.companyId),
      this.warehousesService.findOne(change.warehouseId),
    ]);
    const recipients = users
      .filter((user) => !!user.email)
      .map((user) => ({
        address: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
      }));

    if (!recipients.length) {
      return;
    }

    await this.mailerService.sendStockAlertMail({
      level,
      recipients,
      drinkName: change.drinkName,
      drinkCode: change.drinkCode ?? '',
      warehouseName: warehouse.name,
      quantity: change.after.quantity,
      threshold:
        level === 'critical'
          ? change.after.criticalQuantity
          : change.after.warningQuantity,
    });
  }
}
