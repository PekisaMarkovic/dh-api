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
@Entity({ name: 'drinks' })
export class Drink extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'drink_id' })
  drinkId: number;

  @ApiProperty()
  @Column({ length: 150 })
  name: string;

  @ApiProperty({ description: 'Price per unit' })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  price: number;

  @ApiProperty({ description: 'Units in stock' })
  @Column({ type: 'int', default: 0 })
  quantity: number;

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
