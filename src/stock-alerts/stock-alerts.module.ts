import { Module } from '@nestjs/common';
import { StockAlertsService } from '@/stock-alerts/services/stock-alerts.service';
import { CompaniesModule } from '@/companies/companies.module';
import { WarehousesModule } from '@/warehouses/warehouses.module';
import { MailerModule } from '@/mailer/mailer.module';

@Module({
  imports: [CompaniesModule, WarehousesModule, MailerModule],
  providers: [StockAlertsService],
  exports: [StockAlertsService],
})
export class StockAlertsModule {}
