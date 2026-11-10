import { Module } from '@nestjs/common';
import { ValidationTokenService } from '@/validation-token/services/validation-token.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationToken } from '@/validation-token/entities/validation-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationToken])],
  providers: [ValidationTokenService],
  exports: [ValidationTokenService],
})
export class ValidationTokenModule {}
