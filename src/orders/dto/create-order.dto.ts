import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsInt,
  IsISO8601,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PHONE_PATTERN } from '@/clients/dto/create-contact.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const MAX_ORDER_LINES = 50;
export const MAX_ORDER_QUANTITY = 999;

/** One drink of the cart: only what the buyer picked, the name and the price come from the database */
export class CreateOrderItemDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  drinkId: number;

  @ApiProperty({ example: 2, minimum: 1, maximum: MAX_ORDER_QUANTITY })
  @IsInt()
  @Min(1)
  @Max(MAX_ORDER_QUANTITY)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'Petar Petrović' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ example: 'petar@example.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: '+381 64 123 4567' })
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone: string;

  @ApiProperty({
    example: 'Bulevar kralja Aleksandra 73, Beograd',
    description:
      'Where the courier of the shop delivers the order: the street, the number and the town',
  })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address: string;

  @ApiProperty({
    example: '2026-11-27',
    description:
      'The day of the delivery: from today (tomorrow after 15:00 in Serbia) to one month ahead',
  })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'pickupDate must be a date as YYYY-MM-DD',
  })
  pickupDate: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_LINES)
  @ArrayUnique((item: CreateOrderItemDto) => item.drinkId, {
    message: 'every drink can be in the order only once',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
