const UNITS = [
  'nula',
  'jedan',
  'dva',
  'tri',
  'četiri',
  'pet',
  'šest',
  'sedam',
  'osam',
  'devet',
];
const TEENS = [
  'deset',
  'jedanaest',
  'dvanaest',
  'trinaest',
  'četrnaest',
  'petnaest',
  'šesnaest',
  'sedamnaest',
  'osamnaest',
  'devetnaest',
];
const TENS = [
  '',
  '',
  'dvadeset',
  'trideset',
  'četrdeset',
  'pedeset',
  'šezdeset',
  'sedamdeset',
  'osamdeset',
  'devedeset',
];
const HUNDREDS = [
  '',
  'sto',
  'dvesta',
  'trista',
  'četiristotine',
  'petstotina',
  'šeststotina',
  'sedamstotina',
  'osamstotina',
  'devetstotina',
];

/**
 * 0 - 999, written together the way it is on Serbian invoices.
 * `feminine` is for the numbers that stand in front of "hiljada" (jedna, dve).
 */
const belowThousand = (n: number, feminine = false) => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let words = HUNDREDS[hundreds];

  if (rest >= 10 && rest < 20) {
    return words + TEENS[rest - 10];
  }

  words += TENS[Math.floor(rest / 10)];

  const unit = rest % 10;

  if (unit > 0) {
    if (feminine && unit === 1) words += 'jedna';
    else if (feminine && unit === 2) words += 'dve';
    else words += UNITS[unit];
  }

  return words;
};

// the form of "hiljada" / "milion" depends on how the number ends
const scaleForm = (n: number, one: string, few: string, many: string) => {
  const lastTwo = n % 100;
  const last = n % 10;

  if (lastTwo >= 11 && lastTwo <= 19) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;

  return many;
};

/**
 * Whole number in Serbian words without spaces, e.g. 9756 -> "devethiljadasedamstotinapedesetšest".
 * Works up to 999.999.999, bigger numbers stay as digits.
 */
export const numberToWords = (value: number): string => {
  const n = Math.floor(Math.abs(value));

  if (n === 0) return 'nula';
  if (n > 999_999_999) return String(n);

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  let words = '';

  if (millions > 0) {
    const form = scaleForm(millions, 'milion', 'miliona', 'miliona');

    words += (millions === 1 ? '' : belowThousand(millions)) + form;
  }

  if (thousands > 0) {
    const form = scaleForm(thousands, 'hiljada', 'hiljade', 'hiljada');

    // 1000 is just "hiljadu"
    words +=
      thousands === 1 ? 'hiljadu' : belowThousand(thousands, true) + form;
  }

  if (rest > 0) {
    words += belowThousand(rest);
  }

  return words;
};

/**
 * "devethiljadasedamstotinapedesetšest i 0/100 Din"
 */
export const amountInWords = (amount: number, currency = 'Din') => {
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;

  return `${numberToWords(whole)} i ${fraction}/100 ${currency}`;
};
