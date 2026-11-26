import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Client } from '@/clients/entities/client.entity';
import { AuditEntity } from '@/common/entities/audit.entity';
import { moneyTransformer } from '@/common/helpers/money.helpers';
import { Company } from '@/companies/entities/company.entity';
import { OrderItem } from '@/orders/entities/order-item.entity';
import { OrderStatus } from '@/orders/order-status.enum';

/**
 * An order a visitor sent from the white label site of a company (only when the site allows ordering).
 * The contact data of the buyer is kept as it was typed, there is no account.
 */
// the dashboard lists the orders of a company, the newest first
@Index('IDX_orders_company_created', ['companyId', 'createdAt'])
@Entity({ name: 'orders' })
export class Order extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'order_id' })
  orderId: number;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'FK_orders_company',
  })
  company: Company;

  @ApiProperty({ format: 'uuid', description: 'The site the order came from' })
  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({
    name: 'client_id',
    foreignKeyConstraintName: 'FK_orders_client',
  })
  client: Client;

  @ApiProperty({ example: 'Petar Petrović' })
  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @ApiProperty({ example: 'petar@example.com' })
  @Column({ length: 150 })
  email: string;

  @ApiProperty({ example: '+381 64 123 4567' })
  @Column({ length: 30 })
  phone: string;

  @ApiProperty({
    example: 'Bulevar kralja Aleksandra 73, Beograd',
    description: 'Where the courier of the shop delivers the order',
  })
  // the default only lets synchronize add the column to the rows that exist, an order always has an address
  @Column({ length: 255, default: '' })
  address: string;

  @ApiProperty({
    example: '2026-11-27',
    description: 'The day the courier delivers the order',
  })
  @Column({ name: 'pickup_date', type: 'date' })
  pickupDate: string;

  @ApiProperty({ enum: OrderStatus })
  @Column({ type: 'varchar', length: 20, default: OrderStatus.NEW })
  status: OrderStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Why the order was cancelled (the buyer got it in an email), null otherwise',
  })
  @Column({
    name: 'cancel_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  cancelReason: string | null;

  @ApiProperty({ description: 'The sum of the lines, with VAT' })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  total: number;

  @ApiProperty({ type: () => [OrderItem] })
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: ['insert'] })
  items: OrderItem[];
}
