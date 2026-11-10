/**
 * Everything on the proforma PDF that the system does not know yet.
 * Each value here is MOCKED, replace it with real data when it exists.
 */
export const PROFORMA_PDF_MOCK = {
  // TODO: seller data belongs to the company (companies table: address, PIB, MB, phone, bank account)
  seller: {
    name: 'DRINK HOUSE',
    street: 'FILIPA KLJAJIĆA 82',
    city: 'LOZNICA',
    pib: '115962350',
    mb: '68783143',
    phone: '',
    bankAccount: '160600000276128785',
  },

  // TODO: place of issue belongs to the company (or the warehouse)
  placeOfIssue: 'LOZNICA',

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
