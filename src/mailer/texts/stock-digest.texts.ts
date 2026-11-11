import { DEFAULT_LANGUAGE, LanguageEnums } from '@/common/enums/language.enum';

export type StockDigestTexts = {
  /** the main title in the email */
  title: string;
  subject: (
    criticalCount: number,
    warningCount: number,
    part: string,
  ) => string;
  /** the part of the day in the subject and in the footer: morning / afternoon */
  part: (isMorning: boolean) => string;
  intro: (criticalCount: number, warningCount: number) => string;
  allGood: string;
  subjectAllGood: (part: string) => string;
  criticalTitle: string;
  warningTitle: string;
  drink: string;
  stock: string;
  criticalLimit: string;
  warningLimit: string;
  button: string;
  fallback: string;
  footer: (part: string) => string;
};

/**
 * All the words of the stock overview email, in the language of the person that gets it.
 * (The numbers are written in a way that needs no plural forms.)
 */
export const STOCK_DIGEST_TEXTS: Record<LanguageEnums, StockDigestTexts> = {
  [LanguageEnums.SR]: {
    title: 'Pregled zaliha',
    part: (isMorning) => (isMorning ? 'Jutarnji' : 'Popodnevni'),
    subject: (c, w, part) =>
      `${part} pregled zaliha: ${c} treba dokupiti, ${w} upozorenje`,
    subjectAllGood: (part) => `${part} pregled zaliha: sve je u redu`,
    intro: (c, w) => `Za dokupljivanje: ${c}. Niska zaliha (upozorenje): ${w}.`,
    allGood:
      'Sve je u redu: nijedno piće nije ispod praga za upozorenje ni ispod granice za dokupljivanje.',
    criticalTitle: 'Treba dokupiti',
    warningTitle: 'Upozorenje, zaliha je niska',
    drink: 'Piće',
    stock: 'Stanje',
    criticalLimit: 'Granica',
    warningLimit: 'Prag',
    button: 'Otvori pića',
    fallback: 'Ako dugme ne radi, otvorite ovaj link:',
    footer: (part) =>
      `Ovo je ${part.toLowerCase()} pregled, šalje se svakog dana u 8:00 i 15:00.`,
  },
  [LanguageEnums.EN]: {
    title: 'Stock overview',
    part: (isMorning) => (isMorning ? 'Morning' : 'Afternoon'),
    subject: (c, w, part) =>
      `${part} stock overview: ${c} to buy again, ${w} warning`,
    subjectAllGood: (part) => `${part} stock overview: all good`,
    intro: (c, w) => `To buy again: ${c}. Low stock (warning): ${w}.`,
    allGood:
      'All good: no drink is below its warning quantity or its buy-again quantity.',
    criticalTitle: 'Has to be bought again',
    warningTitle: 'Warning, stock is low',
    drink: 'Drink',
    stock: 'Stock',
    criticalLimit: 'Limit',
    warningLimit: 'Warning at',
    button: 'Open drinks',
    fallback: 'If the button does not work, open this link:',
    footer: (part) =>
      `This is the ${part.toLowerCase()} overview, it is sent every day at 8:00 and 15:00.`,
  },
};

export const getStockDigestTexts = (language?: string): StockDigestTexts =>
  STOCK_DIGEST_TEXTS[language as LanguageEnums] ??
  STOCK_DIGEST_TEXTS[DEFAULT_LANGUAGE];
