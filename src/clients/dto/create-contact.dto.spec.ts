import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContactDto } from '@/clients/dto/create-contact.dto';

const check = (plain: object) =>
  validate(plainToInstance(CreateContactDto, plain));

describe('CreateContactDto', () => {
  it('should accept a name and a phone only', async () => {
    expect(await check({ name: 'Petar', phone: '+381 64 123 456' })).toEqual(
      [],
    );
  });

  it('should treat an empty email and message of the form as not sent', async () => {
    const dto = plainToInstance(CreateContactDto, {
      name: ' Petar ',
      phone: '064123456',
      email: '',
      message: '  ',
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.name).toBe('Petar');
    expect(dto.email).toBeUndefined();
    expect(dto.message).toBeUndefined();
  });

  it.each([
    [{ phone: '064123456' }],
    [{ name: 'Petar' }],
    [{ name: 'Petar', phone: 'abc' }],
    [{ name: 'Petar', phone: '064123456', email: 'not-an-email' }],
    [{ name: 'Petar', phone: '064123456', message: 'x'.repeat(2001) }],
  ])('should reject %j', async (plain) => {
    expect((await check(plain)).length).toBeGreaterThan(0);
  });
});
