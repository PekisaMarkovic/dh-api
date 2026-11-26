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

  describe('sendOrderMails', () => {
    const order = {
      orderId: 12,
      fullName: 'Petar <b>Petrović</b>',
      email: 'petar@example.com',
      phone: '+381 64 123 4567',
      address: 'Bulevar <b>1</b>, Beograd',
      pickupDate: '2026-11-27',
      total: 401,
      items: [
        { name: 'HEINEKEN 0.25L', quantity: 2, unitPrice: 150.5 },
        { name: 'COCA <i>COLA</i>', quantity: 1, unitPrice: 99.999 },
      ],
      siteName: 'Drink House',
      sitePhone: '+381 15 000',
      recipients: [
        { address: 'ana@dh.rs', name: 'Ana' },
        { address: 'marko@dh.rs', name: 'Marko' },
      ],
    };

    it('should send one email to every employee and one to the buyer', async () => {
      await service.sendOrderMails(order);

      expect(brevoService.send).toHaveBeenCalledTimes(3);
      expect(mailTo('ana@dh.rs')!.subject).toContain('Nova porudžbina #12');
      expect(mailTo('marko@dh.rs')).toBeDefined();
      expect(mailTo('petar@example.com')!.subject).toBe(
        'Porudžbina je primljena: Drink House',
      );
    });

    it('should write the day, the drinks, the amounts and the total', async () => {
      await service.sendOrderMails(order);

      const html = mailTo('petar@example.com')!.html;
      expect(html).toContain('27. novembar 2026.');
      expect(html).toContain('HEINEKEN 0.25L');
      // 2 x 150,50
      expect(html).toContain('301,00 RSD');
      expect(html).toContain('401,00 RSD');
      expect(html).toContain('+381 15 000');
      // the courier delivers it there, escaped like everything the buyer typed
      expect(html).toContain('Bulevar &lt;b&gt;1&lt;/b&gt;, Beograd');
      expect(mailTo('ana@dh.rs')!.html).toContain('Adresa za dostavu');
    });

    it('should link the employees to the orders in the dashboard', async () => {
      await service.sendOrderMails(order);

      expect(mailTo('ana@dh.rs')!.html).toContain(
        'https://app.drinkhouse.rs/orders',
      );
    });

    it('should escape what the buyer typed and the names of the drinks', async () => {
      await service.sendOrderMails(order);

      for (const address of ['ana@dh.rs', 'petar@example.com']) {
        const html = mailTo(address)!.html;
        expect(html).not.toContain('<b>Petrović</b>');
        expect(html).not.toContain('<i>COLA</i>');
        expect(html).toContain('COCA &lt;i&gt;COLA&lt;/i&gt;');
      }
    });

    it('should not throw when an email can not be sent', async () => {
      brevoService.send.mockRejectedValue(new Error('down'));

      await expect(service.sendOrderMails(order)).resolves.toBeUndefined();
    });
  });

  describe('sendOrderCancelledMail', () => {
    const cancelled = {
      orderId: 12,
      fullName: 'Petar Petrović',
      email: 'petar@example.com',
      phone: '+381 64 123 4567',
      address: 'Bulevar 1, Beograd',
      pickupDate: '2026-11-27',
      total: 301,
      items: [{ name: 'HEINEKEN 0.25L', quantity: 2, unitPrice: 150.5 }],
      siteName: 'Drink House',
      sitePhone: '+381 15 000',
      reason: 'Nemamo <b>više</b> na stanju.',
    };

    it('should send the buyer the reason, the day, the address and the drinks', async () => {
      await service.sendOrderCancelledMail(cancelled);

      const mail = mailTo('petar@example.com')!;
      expect(mail.subject).toBe('Porudžbina #12 je otkazana: Drink House');
      expect(mail.html).toContain('Razlog');
      expect(mail.html).toContain('Nemamo &lt;b&gt;više&lt;/b&gt; na stanju.');
      expect(mail.html).toContain('Bulevar 1, Beograd');
      expect(mail.html).toContain('HEINEKEN 0.25L');
      expect(mail.html).toContain('301,00 RSD');
    });

    it('should leave out the reason when there is none', async () => {
      await service.sendOrderCancelledMail({ ...cancelled, reason: null });

      expect(mailTo('petar@example.com')!.html).not.toContain('Razlog');
    });

    it('should not throw when the email can not be sent', async () => {
      brevoService.send.mockRejectedValue(new Error('down'));

      await expect(
        service.sendOrderCancelledMail(cancelled),
      ).resolves.toBeUndefined();
    });
  });
});
