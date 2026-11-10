import { PartialType } from '@nestjs/mapped-types';
import { Role } from '@/auth/entities/role.entity';
import { Permission } from '@/auth/entities/permission.entity';
import { RegisterUserDto } from '@/users/dto/register-user.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UserRolesAndPermisssionsDto extends PartialType(RegisterUserDto) {
  @ApiProperty()
  roles?: Role[];

  @ApiProperty()
  permissions?: Permission[];
}
