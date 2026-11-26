import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '@/clients/entities/client.entity';
import { CompaniesModule } from '@/companies/companies.module';
import { Drink } from '@/drinks/entities/drink.entity';
import { MailerModule } from '@/mailer/mailer.module';
import { OrdersController } from '@/orders/controllers/orders.controller';
import { Order } from '@/orders/entities/order.entity';
import { OrderItem } from '@/orders/entities/order-item.entity';
import { OrdersService } from '@/orders/services/orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Drink, Client]),
    CompaniesModule,
    MailerModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
