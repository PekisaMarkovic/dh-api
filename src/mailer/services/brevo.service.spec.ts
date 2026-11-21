import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BrevoService } from '@/mailer/services/brevo.service';

describe('BrevoService', () => {
  let service: BrevoService;
  let env: Record<string, string | undefined>;
  let fetchMock: jest.Mock;
  const realFetch = global.fetch;

  const options = {
    to: [
      { address: 'ana@drinkhouse.rs', name: 'Ana Anic' },
      { address: 'bojan@drinkhouse.rs' },
    ],
    subject: 'Pozivnica',
    html: '<p>Zdravo</p>',
  };

  const answer = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

  const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    env = {
      BREVO_API_KEY: 'key-123',
      MAIL_FROM_EMAIL: 'no-reply@drinkhouse.rs',
      MAIL_FROM_NAME: 'Drink House',
    };
    fetchMock = jest.fn().mockResolvedValue(answer(201, { messageId: 'm-1' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrevoService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile();

    service = module.get(BrevoService);
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  describe('without an API key', () => {
    beforeEach(() => {
      delete env.BREVO_API_KEY;
    });

    it('should skip the email locally and say it was not sent', async () => {
      await expect(service.send(options)).resolves.toEqual({ skipped: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should throw in production, a missing key must not go unnoticed', async () => {
      env.ENVIROMENT = 'production';

      await expect(service.send(options)).rejects.toThrow(
        'BREVO_API_KEY is not set',
      );
    });
  });

  it('should throw when the sender is not set', async () => {
    delete env.MAIL_FROM_EMAIL;

    await expect(service.send(options)).rejects.toThrow(
      'MAIL_FROM_EMAIL is not set',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should send the email to Brevo with the key in the header', async () => {
    await service.send(options);

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(request.method).toBe('POST');
    expect(request.headers['api-key']).toBe('key-123');
  });

  it('should send the sender, the recipients, the subject and the html', async () => {
    await service.send(options);

    expect(sentBody()).toEqual({
      sender: { email: 'no-reply@drinkhouse.rs', name: 'Drink House' },
      to: [
        { email: 'ana@drinkhouse.rs', name: 'Ana Anic' },
        { email: 'bojan@drinkhouse.rs' },
      ],
      subject: 'Pozivnica',
      htmlContent: '<p>Zdravo</p>',
    });
  });

  it('should use the name of the app as the sender name when there is no other', async () => {
    delete env.MAIL_FROM_NAME;
    env.APP_NAME = 'DH';

    await service.send(options);

    expect(sentBody().sender.name).toBe('DH');
  });

  it('should use another address of the API when it is set', async () => {
    env.BREVO_API_URL = 'http://localhost:9999/mock';

    await service.send(options);

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:9999/mock');
  });

  it('should ask Brevo to only check the request in the sandbox', async () => {
    env.BREVO_SANDBOX = 'true';

    await service.send(options);

    expect(sentBody().headers).toEqual({ 'X-Sib-Sandbox': 'drop' });
  });

  it('should not use the sandbox otherwise', async () => {
    await service.send(options);

    expect(sentBody()).not.toHaveProperty('headers');
  });

  it('should return the id of the message', async () => {
    await expect(service.send(options)).resolves.toEqual({
      skipped: false,
      messageId: 'm-1',
    });
  });

  it('should throw with what Brevo said when it refuses the email', async () => {
    fetchMock.mockResolvedValue(
      answer(401, { code: 'unauthorized', message: 'Key not found' }),
    );

    await expect(service.send(options)).rejects.toThrow(
      'Brevo answered 401 unauthorized: Key not found',
    );
  });

  it('should throw even when the answer of Brevo is not json', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(service.send(options)).rejects.toThrow(
      'Brevo answered 502: no message',
    );
  });

  it('should throw the error of the network as it is', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));

    await expect(service.send(options)).rejects.toThrow('timeout');
  });
});
