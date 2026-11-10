import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { getDashboardUrl } from '@/common/helpers/url.helpers';
import { MailAddress, SendMailDto } from '@/mailer/dto';
import { BrevoService } from '@/mailer/services/brevo.service';

/**
 * What the emails of the app are: which template, which subject, which data.
 * The sending itself is done by BrevoService.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly brevoService: BrevoService,
  ) {}

  private replacePlaceholders(
    str: string,
    replacements: Record<string, string>,
  ) {
    return str.replace(/{(.*?)}/g, (_, key) => {
      return replacements[key] || '';
    });
  }

  private async readHtmlTemplate(name: string) {
    // works for ts-node (src), nest build (dist) and running from the project root
    const candidates = [
      path.join(__dirname, '..', 'templates', name),
      path.join(__dirname, 'mailer', 'templates', name),
      path.join(process.cwd(), 'src', 'mailer', 'templates', name),
    ];

    for (const filePath of candidates) {
      try {
        return await fs.readFile(filePath, 'utf-8');
      } catch {
        // try next candidate
      }
    }

    throw new Error(`Could not read mail template ${name}`);
  }

  private async sendMail(
    subject: string,
    recipients: MailAddress[],
    template: string,
    data: Record<string, string>,
  ) {
    const htmlString = await this.readHtmlTemplate(template);
    const html = this.replacePlaceholders(htmlString, data);

    return this.brevoService.send({ to: recipients, subject, html });
  }

  /**
   * Send the invitation to join the platform
   * @param SendMailDto - recipients and data.invitationId
   * @throws HttpException 422 if the email could not be sent
   */
  async sendInvitationMail(dto: SendMailDto) {
    const { data, recipients } = dto;
    const link = `${getDashboardUrl(this.configService)}/first-time-register/${data.invitationId}`;

    try {
      const result = await this.sendMail(
        'Pozivnica za DH',
        recipients,
        'first-time-register.html',
        {
          link,
          valid_days: data.validDays ?? '',
          current_year: `${new Date().getFullYear()}`,
        },
      );

      if (result.skipped) {
        // no Brevo key (local development): the link can still be used by hand
        this.logger.warn(`Invitation link: ${link}`);
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Could not send the invitation email: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new HttpException(
        'Failed to send the invitation email',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }
}
