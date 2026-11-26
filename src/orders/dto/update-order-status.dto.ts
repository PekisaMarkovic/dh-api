import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '@/orders/order-status.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({
    example: 'Nemamo više ovo piće na stanju.',
    description:
      'Only for a cancelled order: why, the buyer gets it in the email (can be empty)',
  })
  @Transform(({ value }: { value: unknown }) => {
    const text = typeof value === 'string' ? value.trim() : value;

    // an empty field of the form is no reason
    return text === '' ? undefined : text;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
