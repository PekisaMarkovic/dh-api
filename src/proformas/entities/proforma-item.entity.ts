import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { moneyTransformer } from '@/common/helpers/money.helpers';
import { Proforma } from '@/proformas/entities/proforma.entity';

/**
 * One line of a proforma. Name and price are copied from the drink,
 * so the proforma does not change when the drink is edited later.
 */
@Entity({ name: 'proforma_items' })
export class ProformaItem {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'proforma_item_id' })
  proformaItemId: number;

  @ApiProperty()
  @Column({ name: 'proforma_id' })
  proformaId: number;

  @ManyToOne(() => Proforma, (proforma) => proforma.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'proforma_id' })
  proforma: Proforma;

  @ApiProperty({ nullable: true })
  @Column({ name: 'drink_id', nullable: true })
  drinkId: number | null;

  @ApiProperty()
  @Column({ length: 150 })
  name: string;

  @ApiProperty({ description: 'Price per unit' })
  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: moneyTransformer,
  })
  unitPrice: number;

  @ApiProperty()
  @Column({ type: 'int' })
  quantity: number;

  @ApiProperty({ description: 'unitPrice * quantity' })
  @Column({
    name: 'line_total',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  lineTotal: number;
}
