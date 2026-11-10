import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drink } from '@/drinks/entities/drink.entity';
import { DrinksService } from '@/drinks/services/drinks.service';
import { DrinksController } from '@/drinks/controllers/drinks.controller';
import { CompaniesModule } from '@/companies/companies.module';
import { WarehousesModule } from '@/warehouses/warehouses.module';
import { StockAlertsModule } from '@/stock-alerts/stock-alerts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Drink]),
    WarehousesModule,
    CompaniesModule,
    StockAlertsModule,
  ],
  controllers: [DrinksController],
  providers: [DrinksService],
  exports: [DrinksService],
})
export class DrinksModule {}
