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
 * A category of drinks (Pivo, Vino, Žestoka pića...). Every company has its own categories,
 * a drink can be in several of them (drink_categories), the menu of the site is filtered by them.
 */
// the name is unique inside a company, a deleted category gives its name free again
@Index('UQ_categories_company_name', ['companyId', 'name'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Entity({ name: 'categories' })
export class Category extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'category_id' })
  categoryId: number;

  @ApiProperty({ example: 'Pivo' })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({
    example: 'pivo',
    description:
      'The name in the address of the site (/karta-pica/pivo), unique in the company, made from the name',
  })
  // the default only lets synchronize add the column to the rows that exist, the migration fills it
  @Column({ length: 120, default: '' })
  slug: string;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: number;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'FK_categories_company',
  })
  company: Company;
}
