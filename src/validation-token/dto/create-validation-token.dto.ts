import { ApiProperty } from '@nestjs/swagger';
import { ValidationTokenTypeEnums } from '@/validation-token/enums/VerificationTokenType';

export class CreateValidationToken {
  @ApiProperty()
  email: string;
  @ApiProperty()
  token: string;
  @ApiProperty()
  validationTokenType: ValidationTokenTypeEnums;
}
