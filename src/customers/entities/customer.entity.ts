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

/**
 * A buyer ("kupac") of a company, it is chosen on a proforma.
 * Only the name matters for now.
 */
@Index(['companyId', 'name'])
@Entity({ name: 'customers' })
export class Customer extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'customer_id' })
  customerId: number;

  @ApiProperty()
  @Column({ length: 150 })
  name: string;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
