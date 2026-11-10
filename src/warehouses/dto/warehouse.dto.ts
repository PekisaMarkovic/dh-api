import { ApiProperty, PartialType, OmitType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty()
  @IsInt()
  companyId: number;
}

export class UpdateWarehouseDto extends PartialType(
  OmitType(CreateWarehouseDto, ['companyId'] as const),
) {}
