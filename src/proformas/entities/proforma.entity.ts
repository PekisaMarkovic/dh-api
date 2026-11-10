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
import { moneyTransformer } from '@/common/helpers/money.helpers';
import { Company } from '@/companies/entities/company.entity';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';
import { User } from '@/users/entities/user.entity';
import { ProformaStatusEnums } from '@/proformas/enums/proforma-status.enum';
import { ProformaItem } from '@/proformas/entities/proforma-item.entity';

@Entity({ name: 'proformas' })
export class Proforma extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'proforma_id' })
  proformaId: number;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty()
  @Column({ name: 'warehouse_id' })
  warehouseId: number;

  @ManyToOne(() => Warehouse, { nullable: false })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @ApiProperty({ nullable: true })
  @Column({ name: 'created_by_id', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @ApiProperty({ enum: ProformaStatusEnums })
  @Column({ type: 'varchar', length: 20, default: ProformaStatusEnums.ACTIVE })
  status: ProformaStatusEnums;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamp', name: 'returned_at', nullable: true })
  returnedAt: Date | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'returned_by_id', nullable: true })
  returnedById: number | null;

  @ApiProperty({ description: 'Sum of all item totals' })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  total: number;

  @ApiProperty({ type: () => [ProformaItem] })
  @OneToMany(() => ProformaItem, (item) => item.proforma, { cascade: true })
  items: ProformaItem[];
}
