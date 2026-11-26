/**
 * All the words of the order emails (Serbian: the sites and their buyers are in Serbia).
 * The courier of the shop delivers the orders. The texts typed by the buyer are escaped by the mailer.
 */
export const ORDER_TEXTS = {
  // to the employees, a new order
  newSubject: (orderId: number, fullName: string, day: string) =>
    `Nova porudžbina #${orderId}: ${fullName} (${day})`,
  newTitle: (orderId: number) => `Nova porudžbina #${orderId}`,
  newIntro: (site: string) =>
    `Stigla je porudžbina sa sajta ${site}. Potvrdite je kupcu i predajte kuriru za navedeni dan.`,
  newButton: 'Otvori porudžbine',
  fallback: 'Ako dugme ne radi, otvorite ovaj link:',

  // to the buyer, the order is received
  receivedSubject: (site: string) => `Porudžbina je primljena: ${site}`,
  receivedTitle: (fullName: string) => `Hvala, ${fullName}!`,
  receivedIntro: (orderId: number) =>
    `Primili smo vašu porudžbinu #${orderId}. Ovo ste poručili:`,
  receivedOutro: (phone: string | null) =>
    `Javićemo vam se da potvrdimo porudžbinu, a naš kurir će je doneti na navedenu adresu.${phone ? ` Za sva pitanja pozovite nas na ${phone}.` : ''}`,

  // to the buyer, the order is cancelled
  cancelledSubject: (orderId: number, site: string) =>
    `Porudžbina #${orderId} je otkazana: ${site}`,
  cancelledTitle: (orderId: number) => `Porudžbina #${orderId} je otkazana`,
  cancelledIntro: (fullName: string) =>
    `Poštovani/a ${fullName}, nažalost moramo da otkažemo vašu porudžbinu. Ovo ste poručili:`,
  reason: 'Razlog',
  cancelledOutro: (phone: string | null) =>
    `Izvinjavamo se zbog neprijatnosti.${phone ? ` Za sva pitanja pozovite nas na ${phone}.` : ''}`,

  // all of them
  deliveryDate: 'Dan dostave',
  address: 'Adresa za dostavu',
  buyer: 'Kupac',
  email: 'Email',
  phone: 'Telefon',
  drink: 'Piće',
  quantity: 'Kol.',
  price: 'Cena',
  amount: 'Iznos',
  total: 'Ukupno',
};
