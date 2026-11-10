import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proforma } from '@/proformas/entities/proforma.entity';
import { ProformaItem } from '@/proformas/entities/proforma-item.entity';
import { ProformasService } from '@/proformas/services/proformas.service';
import { ProformasController } from '@/proformas/controllers/proformas.controller';
import { WarehousesModule } from '@/warehouses/warehouses.module';
import { PdfModule } from '@/pdf/pdf.module';
import { CompaniesModule } from '@/companies/companies.module';
import { CustomersModule } from '@/customers/customers.module';
import { StockAlertsModule } from '@/stock-alerts/stock-alerts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Proforma, ProformaItem]),
    WarehousesModule,
    CompaniesModule,
    CustomersModule,
    StockAlertsModule,
    PdfModule,
  ],
  controllers: [ProformasController],
  providers: [ProformasService],
})
export class ProformasModule {}
