import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';
import { WarehousesService } from '@/warehouses/services/warehouses.service';
import { WarehousesController } from '@/warehouses/controllers/warehouses.controller';
import { CompaniesModule } from '@/companies/companies.module';

@Module({
  imports: [TypeOrmModule.forFeature([Warehouse]), CompaniesModule],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
