import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { getDashboardUrl } from '@/common/helpers/url.helpers';
import { getStockDigestTexts } from '@/mailer/texts/stock-digest.texts';
import {
  MailAddress,
  SendMailDto,
  StockDigestItem,
  StockDigestMailDto,
} from '@/mailer/dto';
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
   * The overview of everything that is low, one email for each recipient (so nobody sees
   * the addresses of the others), written in the language of the recipient.
   * Red: has to be bought again, orange: only a warning. With nothing low it says that all is good.
   * It does not throw, a failed email is only logged.
   * @returns how many emails were sent
   */
  async sendStockDigestMail(dto: StockDigestMailDto) {
    const { critical, warning } = dto;
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Europe/Belgrade',
      }).format(new Date()),
    );
    const isAllGood = !critical.length && !warning.length;
    const common = {
      link: `${getDashboardUrl(this.configService)}/drinks`,
      current_year: `${new Date().getFullYear()}`,
    };

    const results = await Promise.allSettled(
      dto.recipients.map((recipient) => {
        const texts = getStockDigestTexts(recipient.language);
        const part = texts.part(hour < 12);

        return this.sendMail(
          isAllGood
            ? texts.subjectAllGood(part)
            : texts.subject(critical.length, warning.length, part),
          [{ address: recipient.address, name: recipient.name }],
          'stock-digest.html',
          {
            ...common,
            title: texts.title,
            intro: isAllGood
              ? texts.allGood
              : texts.intro(critical.length, warning.length),
            critical_section: this.stockSection(
              texts.criticalTitle,
              '#E11D2E',
              [texts.drink, texts.stock, texts.criticalLimit],
              critical,
            ),
            warning_section: this.stockSection(
              texts.warningTitle,
              '#F28500',
              [texts.drink, texts.stock, texts.warningLimit],
              warning,
            ),
            button: texts.button,
            fallback: texts.fallback,
            footer: texts.footer(part),
          },
        );
      }),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Could not send the stock overview to ${dto.recipients[index].address}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
      }
    });

    return results.filter((result) => result.status === 'fulfilled').length;
  }

  /**
   * One table of the overview (inline styles only, see the template), empty text when there is nothing
   */
  private stockSection(
    title: string,
    color: string,
    labels: [string, string, string],
    items: StockDigestItem[],
  ) {
    if (!items.length) {
      return '';
    }

    const cell = 'padding: 8px 10px; border-bottom: 1px solid #e2e4e9;';
    const rows = items
      .map(
        (item) => `
          <tr>
            <td style="${cell}">${escapeHtml(item.name)}<br /><span style="color: #64748b; font-size: 12px">${escapeHtml(item.code || '-')} &middot; ${escapeHtml(item.warehouseName)}</span></td>
            <td style="${cell} text-align: right; font-weight: 700; color: ${color}">${item.quantity}</td>
            <td style="${cell} text-align: right; color: #64748b">${item.threshold}</td>
          </tr>`,
      )
      .join('');

    return `
      <tr>
        <td style="padding: 16px 32px 0">
          <p style="margin: 0 0 8px; font-family: Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; color: ${color}">${title} (${items.length})</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e4e9; border-left: 4px solid ${color}; border-radius: 6px; font-family: Helvetica, Arial, sans-serif; font-size: 14px; color: #334155">
            <tr style="background-color: #f6f8fa">
              <td style="padding: 8px 10px; color: #64748b; font-size: 12px">${labels[0]}</td>
              <td style="padding: 8px 10px; color: #64748b; font-size: 12px; text-align: right">${labels[1]}</td>
              <td style="padding: 8px 10px; color: #64748b; font-size: 12px; text-align: right">${labels[2]}</td>
            </tr>${rows}
          </table>
        </td>
      </tr>`;
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
