import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ClientPermissionEnums } from '../../auth/enums';

@Entity()
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
    type: 'enum',
    enum: ClientPermissionEnums,
    default: ClientPermissionEnums.READ_USER,
  })
  name: ClientPermissionEnums;
}
