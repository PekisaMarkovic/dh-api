import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drink } from '@/drinks/entities/drink.entity';
import { Company } from '@/companies/entities/company.entity';
import { StockAlertsService } from '@/stock-alerts/services/stock-alerts.service';
import { StockAlertsController } from '@/stock-alerts/controllers/stock-alerts.controller';
import { CompaniesModule } from '@/companies/companies.module';
import { MailerModule } from '@/mailer/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Drink, Company]),
    CompaniesModule,
    MailerModule,
  ],
  controllers: [StockAlertsController],
  providers: [StockAlertsService],
})
export class StockAlertsModule {}
