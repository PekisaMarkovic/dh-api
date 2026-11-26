import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drink } from '@/drinks/entities/drink.entity';
import { DrinksService } from '@/drinks/services/drinks.service';
import { DrinksController } from '@/drinks/controllers/drinks.controller';
import { CategoriesModule } from '@/categories/categories.module';
import { CompaniesModule } from '@/companies/companies.module';
import { StorageModule } from '@/storage/storage.module';
import { WarehousesModule } from '@/warehouses/warehouses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Drink]),
    WarehousesModule,
    CompaniesModule,
    StorageModule,
    CategoriesModule,
  ],
  controllers: [DrinksController],
  providers: [DrinksService],
  exports: [DrinksService],
})
export class DrinksModule {}
