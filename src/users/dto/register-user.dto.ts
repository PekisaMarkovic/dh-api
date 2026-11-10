import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ClientRoleEnums } from '@/auth/enums';

export class RegisterUserDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  phone?: string;
}

export class RegisterUserOptionsDto {
  companyId?: number;
  roles?: ClientRoleEnums[];
}
