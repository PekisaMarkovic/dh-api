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

  @ApiProperty()
  @Column({ length: 150, unique: true })
  name: string;

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
