import { Module } from '@nestjs/common';
import { UsersService } from '@/users/services/users.service';
import { UsersController } from '@/users/controllers/users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { Role } from '@/auth/entities/role.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ValidationTokenModule } from '@/validation-token/validation-token.module';
import { MailerModule } from '@/mailer/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    ValidationTokenModule,
    MailerModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRE') },
      }),
    }),
  ],
  controllers: [UsersController],
  exports: [UsersService],
  providers: [UsersService],
})
export class UsersModule {}
