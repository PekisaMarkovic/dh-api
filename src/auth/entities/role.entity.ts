import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Permission } from '../../auth/entities/permission.entity';
import { ClientRoleEnums } from '../../auth/enums';

@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
    type: 'enum',
    enum: ClientRoleEnums,
    default: ClientRoleEnums.USER,
  })
  name: ClientRoleEnums;

  @ManyToMany(() => User, (user) => user.roles)
  users?: User[];

  @ManyToMany(() => Permission)
  @JoinTable()
  permissions?: Permission[];
}
