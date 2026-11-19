import { Module } from '@nestjs/common';
import { BrevoService } from '@/mailer/services/brevo.service';
import { MailerService } from '@/mailer/services/mailer.service';

@Module({
  providers: [BrevoService, MailerService],
  exports: [MailerService],
})
export class MailerModule {}
