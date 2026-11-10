import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '@/customers/entities/customer.entity';
import { CustomersService } from '@/customers/services/customers.service';
import { CustomersController } from '@/customers/controllers/customers.controller';
import { CompaniesModule } from '@/companies/companies.module';

@Module({
  imports: [TypeOrmModule.forFeature([Customer]), CompaniesModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
