import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from '@/categories/controllers/categories.controller';
import { Category } from '@/categories/entities/category.entity';
import { CategoriesService } from '@/categories/services/categories.service';
import { CompaniesModule } from '@/companies/companies.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category]), CompaniesModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
