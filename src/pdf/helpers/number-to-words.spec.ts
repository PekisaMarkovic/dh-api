import { amountInWords, numberToWords } from '@/pdf/helpers/number-to-words';

describe('number-to-words', () => {
  describe('numberToWords', () => {
    it.each([
      [0, 'nula'],
      [1, 'jedan'],
      [5, 'pet'],
      [10, 'deset'],
      [13, 'trinaest'],
      [19, 'devetnaest'],
      [20, 'dvadeset'],
      [21, 'dvadesetjedan'],
      [99, 'devedesetdevet'],
      [100, 'sto'],
      [200, 'dvesta'],
      [345, 'tristačetrdesetpet'],
      [999, 'devetstotinadevedesetdevet'],
    ])('should write %i', (value, words) => {
      expect(numberToWords(value)).toBe(words);
    });

    it.each([
      [1000, 'hiljadu'],
      [1001, 'hiljadujedan'],
      [2000, 'dvehiljade'],
      [3000, 'trihiljade'],
      [5000, 'pethiljada'],
      [11000, 'jedanaesthiljada'],
      [21000, 'dvadesetjednahiljada'],
      [22000, 'dvadesetdvehiljade'],
      [100000, 'stohiljada'],
    ])('should write the thousands of %i', (value, words) => {
      expect(numberToWords(value)).toBe(words);
    });

    it.each([
      [1_000_000, 'milion'],
      [2_000_000, 'dvamiliona'],
      [5_000_000, 'petmiliona'],
      [1_500_000, 'milionpetstotinahiljada'],
    ])('should write the millions of %i', (value, words) => {
      expect(numberToWords(value)).toBe(words);
    });

    it('should write the amount of the proforma on the example document', () => {
      expect(numberToWords(9756)).toBe('devethiljadasedamstotinapedesetšest');
    });

    it('should ignore the sign and the decimals', () => {
      expect(numberToWords(-5)).toBe('pet');
      expect(numberToWords(5.99)).toBe('pet');
    });

    it('should keep the digits of a number that is too big', () => {
      expect(numberToWords(1_000_000_000)).toBe('1000000000');
    });
  });

  describe('amountInWords', () => {
    it('should write the whole part in words and the cents as a number', () => {
      expect(amountInWords(9756)).toBe(
        'devethiljadasedamstotinapedesetšest i 0/100 Din',
      );
    });

    it('should write the cents', () => {
      expect(amountInWords(1.5)).toBe('jedan i 50/100 Din');
    });

    it('should round to cents', () => {
      expect(amountInWords(2.999)).toBe('tri i 0/100 Din');
    });

    it('should use another currency when it is given', () => {
      expect(amountInWords(10, 'EUR')).toBe('deset i 0/100 EUR');
    });
  });
});
