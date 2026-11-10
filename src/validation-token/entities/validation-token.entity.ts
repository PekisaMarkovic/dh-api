import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValidationTokenTypeEnums } from '../../validation-token/enums/VerificationTokenType';
import { ApiProperty } from '@nestjs/swagger';

@Entity('validation_tokens')
export class ValidationToken {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'validation_token_id' })
  validationTokenId: number;

  @ApiProperty()
  @Column({ type: 'text' })
  token: string;

  @ApiProperty()
  @Column()
  email: string;

  @ApiProperty()
  @Column({ type: 'bigint', name: 'expiration_date', nullable: true })
  expirationDate: number;

  @ApiProperty()
  @Column({
    type: 'enum',
    enum: ValidationTokenTypeEnums,
    default: ValidationTokenTypeEnums.REFRESH,
    name: 'validation_token_type',
  })
  validationTokenType: ValidationTokenTypeEnums;
}
