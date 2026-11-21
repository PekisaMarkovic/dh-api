import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BrevoService } from '@/mailer/services/brevo.service';
import { MailerService } from '@/mailer/services/mailer.service';

describe('MailerService', () => {
  let service: MailerService;
  let env: Record<string, string | undefined>;
  let brevoService: { send: jest.Mock };

  // the emails are sent at the same time, so the order of the calls is not known: find a mail by its recipient
  const mailTo = (address: string) =>
    brevoService.send.mock.calls
      .map(
        ([mail]) =>
          mail as { to: { address: string }[]; subject: string; html: string },
      )
      .find((mail) => mail.to[0].address === address);

  const item = (overrides: Record<string, unknown> = {}) => ({
    name: 'FANTA 1.5L',
    code: '128',
    warehouseName: 'Magacin 1',
    quantity: 2,
    threshold: 5,
    ...overrides,
  });

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    env = {
      ENVIROMENT: 'production',
      APP_DASHBOARD: 'https://app.drinkhouse.rs',
    };
    brevoService = {
      send: jest.fn().mockResolvedValue({ skipped: false, messageId: 'm-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
        { provide: BrevoService, useValue: brevoService },
      ],
    }).compile();

    service = module.get(MailerService);
  });

  describe('sendInvitationMail', () => {
    const dto = {
      recipients: [{ name: '', address: 'novi@drinkhouse.rs' }],
      data: { invitationId: 'abc-123', validDays: '7' },
    };

    it('should send the invitation with a link that has the id of the invitation', async () => {
      await service.sendInvitationMail(dto);

      const mail = brevoService.send.mock.calls[0][0];
      expect(mail.to).toEqual(dto.recipients);
      expect(mail.subject).toBe('Pozivnica za DH');
      expect(mail.html).toContain(
        'https://app.drinkhouse.rs/first-time-register/abc-123',
      );
    });

    it('should write the days the invitation is valid in the mail', async () => {
      await service.sendInvitationMail(dto);

      expect(brevoService.send.mock.calls[0][0].html).toContain('7');
      // all the placeholders of the template are filled
      expect(brevoService.send.mock.calls[0][0].html).not.toMatch(
        /\{(link|valid_days|current_year)\}/,
      );
    });

    it('should mark the subject as local outside of production, so it is never taken for a real mail', async () => {
      env.ENVIROMENT = 'development';

      await service.sendInvitationMail(dto);

      expect(brevoService.send.mock.calls[0][0].subject).toBe(
        '[LOCAL] Pozivnica za DH',
      );
    });

    it('should return what the sender returned', async () => {
      await expect(service.sendInvitationMail(dto)).resolves.toEqual({
        skipped: false,
        messageId: 'm-1',
      });
    });

    it('should log the link when no email was sent, so it can be used by hand', async () => {
      brevoService.send.mockResolvedValue({ skipped: true });

      await service.sendInvitationMail(dto);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Invitation link: https://app.drinkhouse.rs/first-time-register/abc-123',
      );
    });

    it('should throw HttpException 422 when the email can not be sent', async () => {
      brevoService.send.mockRejectedValue(new Error('Brevo answered 401'));

      const error = await service
        .sendInvitationMail(dto)
        .catch((e: HttpException) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      expect((error as HttpException).message).toBe(
        'Failed to send the invitation email',
      );
    });
  });

  describe('sendStockDigestMail', () => {
    const recipients = [
      { address: 'ana@drinkhouse.rs', name: 'Ana Anic', language: 'sr' },
      { address: 'bojan@drinkhouse.rs', name: 'Bojan', language: 'en' },
    ];

    it('should send one email to every recipient, so nobody sees the addresses of the others', async () => {
      await service.sendStockDigestMail({
        recipients,
        critical: [item()],
        warning: [],
      });

      expect(brevoService.send).toHaveBeenCalledTimes(2);
      expect(mailTo('ana@drinkhouse.rs')?.to).toEqual([
        { address: 'ana@drinkhouse.rs', name: 'Ana Anic' },
      ]);
      expect(mailTo('bojan@drinkhouse.rs')?.to).toEqual([
        { address: 'bojan@drinkhouse.rs', name: 'Bojan' },
      ]);
    });

    it('should write every email in the language of its recipient', async () => {
      await service.sendStockDigestMail({
        recipients,
        critical: [item()],
        warning: [],
      });

      expect(mailTo('ana@drinkhouse.rs')?.subject).toMatch(/pregled zaliha/);
      expect(mailTo('bojan@drinkhouse.rs')?.subject).toMatch(/stock overview/);
    });

    it('should say in the subject how many drinks are low', async () => {
      await service.sendStockDigestMail({
        recipients: [recipients[1]],
        critical: [item(), item({ name: 'X' })],
        warning: [item({ name: 'Y' })],
      });

      expect(brevoService.send.mock.calls[0][0].subject).toContain(
        '2 to buy again, 1 warning',
      );
    });

    it('should say that all is good when nothing is low', async () => {
      await service.sendStockDigestMail({
        recipients: [recipients[1]],
        critical: [],
        warning: [],
      });

      expect(brevoService.send.mock.calls[0][0].subject).toContain('all good');
    });

    it('should show the drinks of both tables with their stock and their limit', async () => {
      await service.sendStockDigestMail({
        recipients: [recipients[1]],
        critical: [item()],
        warning: [item({ name: 'TUBORG 0.33L', quantity: 8, threshold: 12 })],
      });

      const { html } = brevoService.send.mock.calls[0][0];
      expect(html).toContain('FANTA 1.5L');
      expect(html).toContain('TUBORG 0.33L');
      expect(html).toContain('Magacin 1');
    });

    it('should not put the names that were typed by people into the html as they are', async () => {
      await service.sendStockDigestMail({
        recipients: [recipients[1]],
        critical: [
          item({ name: '<script>alert("x")</script>', warehouseName: 'A & B' }),
        ],
        warning: [],
      });

      const { html } = brevoService.send.mock.calls[0][0];
      expect(html).not.toContain('<script>alert');
      expect(html).toContain(
        '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
      );
      expect(html).toContain('A &amp; B');
    });

    it('should show a dash for a drink without a code', async () => {
      await service.sendStockDigestMail({
        recipients: [recipients[1]],
        critical: [item({ code: '' })],
        warning: [],
      });

      expect(brevoService.send.mock.calls[0][0].html).toContain(
        '- &middot; Magacin 1',
      );
    });

    it('should link to the drinks of the dashboard', async () => {
      await service.sendStockDigestMail({
        recipients: [recipients[1]],
        critical: [item()],
        warning: [],
      });

      expect(brevoService.send.mock.calls[0][0].html).toContain(
        'https://app.drinkhouse.rs/drinks',
      );
    });

    it('should return how many emails were sent', async () => {
      await expect(
        service.sendStockDigestMail({
          recipients,
          critical: [item()],
          warning: [],
        }),
      ).resolves.toBe(2);
    });

    it('should not throw when an email fails, it is only logged, and the others are still sent', async () => {
      // the mail of Ana fails, whichever of the two is sent first
      brevoService.send.mockImplementation(
        (mail: { to: { address: string }[] }) =>
          mail.to[0].address === 'ana@drinkhouse.rs'
            ? Promise.reject(new Error('Brevo answered 500'))
            : Promise.resolve({ skipped: false }),
      );

      await expect(
        service.sendStockDigestMail({
          recipients,
          critical: [item()],
          warning: [],
        }),
      ).resolves.toBe(1);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('ana@drinkhouse.rs'),
      );
    });
  });
});
