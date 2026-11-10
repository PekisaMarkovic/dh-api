import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { getDashboardUrl } from '@/common/helpers/url.helpers';
import { MailAddress, SendMailDto, StockAlertMailDto } from '@/mailer/dto';
import { BrevoService } from '@/mailer/services/brevo.service';
import { SmtpService } from '@/mailer/services/smtp.service';

// the names of drinks and warehouses are typed by people, so they can not go into the html as they are
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
    private readonly smtpService: SmtpService,
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

    // SMTP is used when it is set up (SMTP_HOST), otherwise the Brevo API
    const sender = this.smtpService.isConfigured()
      ? this.smtpService
      : this.brevoService;

    return sender.send({ to: recipients, subject, html });
  }

  /**
   * Send the "stock is low" email to every recipient, one email for each of them,
   * so nobody sees the addresses of the others.
   * Level warning: the drink fell below the warning quantity.
   * Level critical: it fell below the quantity where it has to be bought again.
   * It does not throw, a failed email is only logged (the stock change already happened).
   */
  async sendStockAlertMail(dto: StockAlertMailDto) {
    const isCritical = dto.level === 'critical';
    const template = isCritical ? 'stock-critical.html' : 'stock-warning.html';
    const subject = isCritical
      ? `Hitno: treba dokupiti - ${dto.drinkName}`
      : `Upozorenje: niska zaliha - ${dto.drinkName}`;
    const data = {
      drink_name: escapeHtml(dto.drinkName),
      drink_code: escapeHtml(dto.drinkCode || '-'),
      warehouse_name: escapeHtml(dto.warehouseName),
      quantity: String(dto.quantity),
      threshold: String(dto.threshold),
      link: `${getDashboardUrl(this.configService)}/drinks`,
      current_year: `${new Date().getFullYear()}`,
    };

    const results = await Promise.allSettled(
      dto.recipients.map((recipient) =>
        this.sendMail(subject, [recipient], template, data),
      ),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Could not send the stock alert to ${dto.recipients[index].address}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
      }
    });

    return results.filter((result) => result.status === 'fulfilled').length;
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
        // no mail provider is set up (local development): the link can still be used by hand
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
