import { Module } from '@nestjs/common';
import { BrevoService } from '@/mailer/services/brevo.service';
import { SmtpService } from '@/mailer/services/smtp.service';
import { MailerService } from '@/mailer/services/mailer.service';

@Module({
  providers: [BrevoService, SmtpService, MailerService],
  exports: [MailerService],
})
export class MailerModule {}
