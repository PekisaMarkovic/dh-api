import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { SendOptions, SendResult } from '@/mailer/dto';

/**
 * Sends an email through SMTP, e.g. a Gmail account with an app password.
 *
 * Environment variables:
 *   SMTP_HOST        - e.g. smtp.gmail.com
 *   SMTP_PORT        - 587 (STARTTLS, default) or 465 (SSL)
 *   SMTP_USER        - the SMTP login, e.g. the Gmail address
 *   SMTP_PASSWORD    - the password (for Gmail an app password, 16 letters)
 *   MAIL_FROM_EMAIL  - sender address, for Gmail it has to be the same as SMTP_USER
 *   MAIL_FROM_NAME   - sender name, defaults to APP_NAME
 */
@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);

  constructor(private readonly configService: ConfigService) {}

  async send({ to, subject, html }: SendOptions): Promise<SendResult> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get('SMTP_PORT') || 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    const senderEmail = this.configService.get<string>('MAIL_FROM_EMAIL');

    if (!host || !user || !pass) {
      // locally the app works without SMTP, in production a missing setup must not go unnoticed
      if (this.configService.get('ENVIROMENT') === 'production') {
        throw new Error(
          'SMTP_HOST, SMTP_USER and SMTP_PASSWORD have to be set',
        );
      }

      this.logger.warn(
        `SMTP is not set up, email "${subject}" to ${to.map((t) => t.address).join(', ')} was NOT sent`,
      );

      return { skipped: true };
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
