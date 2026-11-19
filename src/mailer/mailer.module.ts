import { Module } from '@nestjs/common';
import { SmtpService } from '@/mailer/services/smtp.service';
import { MailerService } from '@/mailer/services/mailer.service';

@Module({
  providers: [SmtpService, MailerService],
  exports: [MailerService],
})
export class MailerModule {}
