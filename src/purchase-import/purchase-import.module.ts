import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drink } from '@/drinks/entities/drink.entity';
import { CompaniesModule } from '@/companies/companies.module';
import { PurchaseImport } from '@/purchase-import/entities/purchase-import.entity';
import { PurchaseImportItem } from '@/purchase-import/entities/purchase-import-item.entity';
import { WarehousesModule } from '@/warehouses/warehouses.module';
import { PurchaseImportController } from '@/purchase-import/controllers/purchase-import.controller';
import { PurchaseImportService } from '@/purchase-import/services/purchase-import.service';
import { AiModule } from '@/ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Drink, PurchaseImport, PurchaseImportItem]),
    WarehousesModule,
    CompaniesModule,
    AiModule,
  ],
  controllers: [PurchaseImportController],
  providers: [PurchaseImportService],
})
export class PurchaseImportModule {}
