import { BadRequestException } from '@nestjs/common';
import { parseOptionalInt } from '@/common/helpers/query.helpers';

describe('parseOptionalInt', () => {
  it('should turn the text of a whole number into a number', () => {
    expect(parseOptionalInt('12')).toBe(12);
    expect(parseOptionalInt('0')).toBe(0);
  });

  it('should return undefined when the param is missing or empty', () => {
    expect(parseOptionalInt(undefined)).toBeUndefined();
    expect(parseOptionalInt('')).toBeUndefined();
  });

  it.each(['abc', '1.5', '-3', '12a', ' 12'])(
    'should throw BadRequestException for %p',
    (value) => {
      expect(() => parseOptionalInt(value)).toThrow(BadRequestException);
    },
  );

  it('should name the param in the message', () => {
    expect(() => parseOptionalInt('abc', 'companyId')).toThrow(
      'companyId must be a number',
    );
  });
});
