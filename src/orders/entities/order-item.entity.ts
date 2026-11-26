import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { moneyTransformer } from '@/common/helpers/money.helpers';
import { Order } from '@/orders/entities/order.entity';

/**
 * One line of an order. The name, the code and the price are copied from the drink when the order comes,
 * so the order does not change when the drink is edited or deleted later.
 */
@Entity({ name: 'order_items' })
export class OrderItem {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'order_item_id' })
  orderItemId: number;

  @ApiProperty()
  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'FK_order_items_order',
  })
  order: Order;

  @ApiProperty({
    nullable: true,
    description: 'null when the drink was deleted later',
  })
  @Column({ name: 'drink_id', type: 'int', nullable: true })
  drinkId: number | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @ApiProperty()
  @Column({ length: 150 })
  name: string;

  @ApiProperty({ description: 'Price per unit when the order came' })
  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 3,
    transformer: moneyTransformer,
  })
  unitPrice: number;

  @ApiProperty()
  @Column({ type: 'int' })
  quantity: number;
}
