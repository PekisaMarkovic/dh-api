import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../auth/entities/permission.entity';
import { DEFAULT_LANGUAGE, LanguageEnums } from '@/common/enums/language.enum';
import { Company } from '@/companies/entities/company.entity';
import { Role } from '../../auth/entities/role.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId: number;

  @ApiProperty()
  @Column({ length: 100, name: 'first_name' })
  firstName: string;

  @ApiProperty()
  @Column({ length: 100, name: 'last_name' })
  lastName: string;

  @ApiProperty({ enum: LanguageEnums })
  @Column({ type: 'varchar', length: 5, default: DEFAULT_LANGUAGE })
  language: LanguageEnums;

  @ApiProperty()
  @Column({ type: 'date', name: 'date_of_birth', nullable: true })
  dateOfBirth: Date;

  @ApiProperty()
  @Column({ type: 'date', name: 'created_at', default: new Date() })
  createdAt: Date;

  @ApiProperty()
  @Column({ type: 'date', name: 'updated_at', nullable: true })
  updatedAt: Date;

  @ApiProperty()
  @Column({ type: 'date', name: 'deleted_at', nullable: true })
  deletedAt: Date;

  @ApiProperty()
  @Column({ type: 'date', name: 'last_logged_in_at', nullable: true })
  lastLoggedInAt: Date;

  @ApiProperty()
  @Column({ unique: true })
  email: string;

  @ApiProperty()
  @Column({ unique: true, nullable: true, name: 'phone_number' })
  phoneNumber: string;

  @ApiProperty()
  @Column({ unique: true, nullable: true, select: false })
  password: string;

  @ApiProperty()
  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable()
  roles?: Role[];

  // Ability to also directly assign permissions to user
  // means more flexibility with potentially more complexity
  @ApiProperty()
  @ManyToMany(() => Permission)
  @JoinTable()
  permissions?: Permission[];

  @ApiProperty({ nullable: true })
  @Column({ name: 'company_id', nullable: true })
  companyId: number | null;

  @ManyToOne(() => Company, (company) => company.users, { nullable: true })
  @JoinColumn({ name: 'company_id' })
  company?: Company;
}
