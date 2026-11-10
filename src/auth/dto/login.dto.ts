import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class TokenDto {
  @ApiProperty()
  access_token: string;
  @ApiProperty()
  refresh_token: string;
}
