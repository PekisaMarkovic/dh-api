import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AuditEntity } from '@/common/entities/audit.entity';
import { Company } from '@/companies/entities/company.entity';
import { Drink } from '@/drinks/entities/drink.entity';

@Entity({ name: 'warehouses' })
export class Warehouse extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'warehouse_id' })
  warehouseId: number;

  @ApiProperty()
  @Column({ length: 150 })
  name: string;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: number;

  @ApiProperty({ type: () => Company })
  @ManyToOne(() => Company, (company) => company.warehouses, {
    nullable: false,
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty({ type: () => [Drink] })
  @OneToMany(() => Drink, (drink) => drink.warehouse)
  drinks: Drink[];
}
