import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AuditEntity } from '@/common/entities/audit.entity';
import { Company } from '@/companies/entities/company.entity';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';

// company_id is denormalized from the warehouse so drinks can be searched per company without a join
@Index(['companyId', 'name'])
// the article code is unique inside a company, a deleted drink gives its code free again
@Index(['companyId', 'code'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Entity({ name: 'drinks' })
export class Drink extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'drink_id' })
  drinkId: number;

  @ApiProperty()
  @Column({ length: 150 })
  name: string;

  @ApiProperty({
    description: 'Article code (sifra artikla)',
    example: '352',
  })
  @Column({ length: 50, nullable: true })
  code: string;

  @ApiProperty({ description: 'Price per unit' })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 3,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  price: number;

  @ApiProperty({ description: 'Units in stock' })
  @Column({ type: 'int', default: 0 })
  quantity: number;

  @ApiProperty({
    description:
      'Warning: when the quantity falls below this number the drink is orange (0 = no warning)',
  })
  @Column({ name: 'warning_quantity', type: 'int', default: 0 })
  warningQuantity: number;

  @ApiProperty({
    description:
      'Critical: when the quantity falls below this number the drink has to be bought again, it is red (0 = off)',
  })
  @Column({ name: 'critical_quantity', type: 'int', default: 0 })
  criticalQuantity: number;

  @ApiProperty()
  @Column({ name: 'warehouse_id' })
  warehouseId: number;

  @ApiProperty({ type: () => Warehouse })
  @ManyToOne(() => Warehouse, (warehouse) => warehouse.drinks, {
    nullable: false,
  })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: number;

  @ManyToOne(() => Company, (company) => company.drinks, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
