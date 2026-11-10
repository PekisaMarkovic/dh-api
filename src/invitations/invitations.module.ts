import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from '@/invitations/entities/invitation.entity';
import { InvitationsService } from '@/invitations/services/invitations.service';
import { InvitationsController } from '@/invitations/controllers/invitations.controller';
import { UsersModule } from '@/users/users.module';
import { CompaniesModule } from '@/companies/companies.module';
import { MailerModule } from '@/mailer/mailer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation]),
    UsersModule,
    MailerModule,
    CompaniesModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
