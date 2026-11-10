import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { BrevoSendOptions, BrevoSendResult } from '@/mailer/dto';

/**
 * Sends an email through any SMTP server (Brevo, Gmail, your own).
 *
 * Environment variables:
 *   SMTP_HOST        - e.g. smtp-relay.brevo.com
 *   SMTP_PORT        - 587 (STARTTLS, default) or 465 (SSL)
 *   SMTP_USER        - the SMTP login (for Brevo: SMTP & API -> SMTP, e.g. 8f3a1b001@smtp-brevo.com)
 *   SMTP_PASSWORD    - the SMTP key / password
 *   MAIL_FROM_EMAIL  - sender address, it has to be a verified sender at the provider
 *   MAIL_FROM_NAME   - sender name, defaults to APP_NAME
 */
@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);

  constructor(private readonly configService: ConfigService) {}

  /** true when SMTP is set up, so it is the one that sends */
  isConfigured() {
    return !!this.configService.get<string>('SMTP_HOST');
  }

  async send({
    to,
    subject,
    html,
  }: BrevoSendOptions): Promise<BrevoSendResult> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get('SMTP_PORT') || 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    const senderEmail = this.configService.get<string>('MAIL_FROM_EMAIL');

    if (!user || !pass) {
      throw new Error('SMTP_USER and SMTP_PASSWORD have to be set');
    }

    if (!senderEmail) {
      throw new Error('MAIL_FROM_EMAIL is not set');
    }

    const transporter = createTransport({
      host,
      port,
      // 465 is SSL from the start, 587 starts plain and switches to TLS (STARTTLS)
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    try {
      const info = await transporter.sendMail({
        from: {
          name:
            this.configService.get<string>('MAIL_FROM_NAME') ||
            this.configService.get<string>('APP_NAME') ||
            '',
          address: senderEmail,
        },
        to: to.map(({ address, name }) => ({ name: name ?? '', address })),
        subject,
        html,
      });

      return { skipped: false, messageId: info.messageId };
    } catch (error) {
      this.logger.error(
        `SMTP ${host}:${port} failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw error;
    } finally {
      transporter.close();
    }
  }
}
