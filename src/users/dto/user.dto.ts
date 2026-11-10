import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { LanguageEnums } from '@/common/enums/language.enum';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class FirstTimeRegisterDto {
  @ApiProperty()
  @IsString()
  invitationId: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false, enum: LanguageEnums })
  @IsOptional()
  @IsEnum(LanguageEnums)
  language?: LanguageEnums;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (value === '' ? null : value))
  phoneNumber?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value === '' ? null : value))
  dateOfBirth?: string | null;
}
