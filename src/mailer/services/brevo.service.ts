import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoSendOptions, BrevoSendResult } from '@/mailer/dto';

const DEFAULT_BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The only place that talks to Brevo (transactional email API).
 * It knows nothing about templates or what an email is about, see MailerService for that.
 *
 * Environment variables:
 *   BREVO_API_KEY    - API key from Brevo (SMTP & API -> API keys)
 *   MAIL_FROM_EMAIL  - sender address, it has to be a verified sender in Brevo
 *   MAIL_FROM_NAME   - sender name, defaults to APP_NAME
 *   BREVO_SANDBOX    - "true" asks Brevo to only validate the request, nothing is delivered
 *   BREVO_API_URL    - optional, only to point the service at a mock in tests
 */
@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);

  constructor(private readonly configService: ConfigService) {}

  async send({
    to,
    subject,
    html,
  }: BrevoSendOptions): Promise<BrevoSendResult> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');

    if (!apiKey) {
      // locally the app works without Brevo, in production a missing key must not go unnoticed
      if (this.configService.get('ENVIROMENT') === 'production') {
        throw new Error('BREVO_API_KEY is not set');
      }

      this.logger.warn(
        `BREVO_API_KEY is not set, email "${subject}" to ${to.map((t) => t.address).join(', ')} was NOT sent`,
      );

      return { skipped: true };
    }

    const senderEmail = this.configService.get<string>('MAIL_FROM_EMAIL');

    if (!senderEmail) {
      throw new Error('MAIL_FROM_EMAIL is not set');
    }

    const response = await fetch(
      this.configService.get<string>('BREVO_API_URL') || DEFAULT_BREVO_URL,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          sender: {
            email: senderEmail,
            name:
              this.configService.get<string>('MAIL_FROM_NAME') ||
              this.configService.get<string>('APP_NAME') ||
              undefined,
          },
          to: to.map(({ address, name }) => ({
            email: address,
            ...(name ? { name } : {}),
          })),
          subject,
          htmlContent: html,
          // Brevo sandbox: the request is checked and answered, but no email is delivered
          ...(this.configService.get('BREVO_SANDBOX') === 'true'
            ? { headers: { 'X-Sib-Sandbox': 'drop' } }
            : {}),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    const body = (await response.json().catch(() => ({}))) as {
      messageId?: string;
      code?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(
        `Brevo answered ${response.status}${body.code ? ` ${body.code}` : ''}: ${body.message ?? 'no message'}`,
      );
    }

    return { skipped: false, messageId: body.messageId };
  }
}
