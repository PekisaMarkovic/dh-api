import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AuditEntity } from '@/common/entities/audit.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { User } from '@/users/entities/user.entity';
import { Warehouse } from '@/warehouses/entities/warehouse.entity';

@Entity({ name: 'companies' })
export class Company extends AuditEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'company_id' })
  companyId: number;

  @ApiProperty({
    description: 'The name of the company, it is also printed on the documents',
    example: 'KNEZ BAR',
  })
  @Column({ length: 150, unique: true })
  name: string;

  // ---- the data of the company that is printed on the documents (the proforma PDF), the name is `name` ----

  @ApiProperty({ example: 'KNEZ MIHAILOVA 22' })
  @Column({ length: 150, default: '' })
  street: string;

  @ApiProperty({ example: 'BEOGRAD' })
  @Column({ length: 100, default: '' })
  city: string;

  @ApiProperty({ description: 'Tax number (PIB)', example: '123456789' })
  @Column({ length: 20, default: '' })
  pib: string;

  @ApiProperty({
    description: 'Company registration number (matični broj)',
    example: '12345678',
  })
  @Column({ name: 'registration_number', length: 20, default: '' })
  registrationNumber: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @ApiProperty({ description: 'Bank account', example: '160600000012345678' })
  @Column({ name: 'bank_account', length: 40, default: '' })
  bankAccount: string;

  @ApiProperty({
    nullable: true,
    description:
      'The name printed as the issuer of the proforma PDF, the name of the employee is printed when it is empty',
    example: 'Petar Petrovic',
  })
  @Column({ name: 'invoice_name', type: 'varchar', length: 150, nullable: true })
  invoiceName: string | null;

  @ApiProperty({ type: () => [Warehouse] })
  @OneToMany(() => Warehouse, (warehouse) => warehouse.company)
  warehouses: Warehouse[];

  // every company creates its own drinks, a drink belongs to exactly one company
  @ApiProperty({ type: () => [Drink] })
  @OneToMany(() => Drink, (drink) => drink.company)
  drinks: Drink[];

  @OneToMany(() => User, (user) => user.company)
  users: User[];
}
