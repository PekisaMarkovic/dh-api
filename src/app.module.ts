import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard, PermissionsGuard, RolesGuard } from '@/auth/guards';
import { MailerModule } from '@/mailer/mailer.module';
import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';
import { ValidationTokenModule } from '@/validation-token/validation-token.module';
import { InvitationsModule } from '@/invitations/invitations.module';
import { Invitation } from '@/invitations/entities/invitation.entity';
import { CompaniesModule } from '@/companies/companies.module';
import { WarehousesModule } from '@/warehouses/warehouses.module';
import { DrinksModule } from '@/drinks/drinks.module';
import { CustomersModule } from '@/customers/customers.module';
import { Customer } from '@/customers/entities/customer.entity';
import { Company } from '@/companies/entities/company.entity';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { ProformasModule } from '@/proformas/proformas.module';
import { Proforma } from '@/proformas/entities/proforma.entity';
import { ProformaItem } from '@/proformas/entities/proforma-item.entity';
import { SeederModule } from '@/seeder/seeder.module';
import { User } from '@/users/entities/user.entity';
import { Role } from '@/auth/entities/role.entity';
import { Permission } from '@/auth/entities/permission.entity';
import { ValidationToken } from '@/validation-token/entities/validation-token.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: Number(configService.get('DB_PORT')),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        // hosted databases (Neon, ...) accept only encrypted connections: DB_SSL=true
        ssl: configService.get('DB_SSL') === 'true',
        entities: [
          User,
          Role,
          Permission,
          ValidationToken,
          Invitation,
          Company,
          Warehouse,
          Drink,
          Customer,
          Proforma,
          ProformaItem,
        ],
        synchronize: true,
      }),
    }),
    MailerModule,
    AuthModule,
    UsersModule,
    ValidationTokenModule,
    InvitationsModule,
    CompaniesModule,
    WarehousesModule,
    DrinksModule,
    CustomersModule,
    ProformasModule,
    SeederModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
