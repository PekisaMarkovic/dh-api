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
 * Code and name are the ones that always exist, the rest is optional.
 */
@Index(['companyId', 'name'])
// the code is unique inside a company, a deleted customer gives its code free again
@Index(['companyId', 'code'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Entity({ name: 'customers' })
export class Customer extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'customer_id' })
  customerId: number;

  @ApiProperty({
    nullable: true,
    description: 'Customer code (sifra)',
    example: '12',
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @ApiProperty()
  @Column({ length: 150 })
  name: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 150, nullable: true })
  address: string | null;

  @ApiProperty({ nullable: true, description: 'Tax number (PIB)' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  pib: string | null;

  @ApiProperty({ nullable: true, description: 'Kind of customer, e.g. SRB' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  type: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}
