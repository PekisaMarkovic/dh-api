/**
 * Everything on the proforma PDF that the system does not know yet.
 * Each value here is MOCKED, replace it with real data when it exists.
 */
export const PROFORMA_PDF_MOCK = {
  // TODO: unit of measure belongs to the drink (KOM, L, ...)
  unitOfMeasure: 'KOM',

  // TODO: weight of the goods, needs a weight on every drink
  weightKg: 0,

  // TODO: the proforma number is "<proformaId>/<yy>", it should be a counter that restarts every year
  // TODO: the name of the software is left out for now, only "Software:" is printed
  software: 'Software:',
  // TODO: unknown marker that is printed next to the software name in the footer
  footerMarker: 'p',
};
