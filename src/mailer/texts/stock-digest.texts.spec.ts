import { LanguageEnums } from '@/common/enums/language.enum';
import {
  getStockDigestTexts,
  STOCK_DIGEST_TEXTS,
} from '@/mailer/texts/stock-digest.texts';

describe('stock-digest.texts', () => {
  describe('getStockDigestTexts', () => {
    it('should return the texts of the language', () => {
      expect(getStockDigestTexts('sr')).toBe(
        STOCK_DIGEST_TEXTS[LanguageEnums.SR],
      );
      expect(getStockDigestTexts('en')).toBe(
        STOCK_DIGEST_TEXTS[LanguageEnums.EN],
      );
    });

    it.each([undefined, '', 'de'])(
      'should use English for the language %p',
      (language) => {
        expect(getStockDigestTexts(language)).toBe(
          STOCK_DIGEST_TEXTS[LanguageEnums.EN],
        );
      },
    );
  });

  describe.each(Object.values(LanguageEnums))('texts in %s', (language) => {
    const texts = STOCK_DIGEST_TEXTS[language];

    it('should write the part of the day', () => {
      expect(texts.part(true)).not.toBe(texts.part(false));
    });

    it('should put the counts and the part of the day in the subject', () => {
      const subject = texts.subject(3, 2, texts.part(true));

      expect(subject).toContain('3');
      expect(subject).toContain('2');
      expect(subject).toContain(texts.part(true));
    });

    it('should have a subject for the day when all is good', () => {
      expect(texts.subjectAllGood(texts.part(false))).toContain(
        texts.part(false),
      );
    });

    it('should put the counts in the intro', () => {
      expect(texts.intro(4, 1)).toMatch(/4.*1/);
    });

    it('should say when the overview is sent', () => {
      expect(texts.footer(texts.part(true))).toContain('8:00');
    });
  });
});
