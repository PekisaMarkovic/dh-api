import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '@/auth/entities/permission.entity';
import { Role } from '@/auth/entities/role.entity';
import { CompaniesModule } from '@/companies/companies.module';
import { UsersModule } from '@/users/users.module';
import { AppSeederService } from '@/seeder/app-seeder.service';
import { UserSeederService } from '@/seeder/services/user-seeder.service';
import { CompanySeederService } from '@/seeder/services/company-seeder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission]),
    UsersModule,
    CompaniesModule,
  ],
  providers: [AppSeederService, UserSeederService, CompanySeederService],
})
export class SeederModule {}
