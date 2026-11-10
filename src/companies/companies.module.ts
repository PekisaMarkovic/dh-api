import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@/users/users.module';
import { Company } from '@/companies/entities/company.entity';
import { CompaniesService } from '@/companies/services/companies.service';
import { CompaniesController } from '@/companies/controllers/companies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company]), UsersModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
