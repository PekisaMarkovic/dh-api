export interface PurchaseItem {
  name: string;
  quantity: number;
  /** the drink of the warehouse the AI matched the line to, null when none is the same drink */
  drinkId: number | null;
}

/** A drink of the warehouse, sent to the AI so it can match the lines to them */
export interface KnownDrink {
  drinkId: number;
  name: string;
}

export interface AiFile {
  mimetype: string;
  buffer: Buffer;
  originalname?: string;
}

/** What the AI gave back: the cleaned lines and the answer as the AI returned it (JSON) */
export interface PurchaseExtraction {
  /** The name of the document: the buyer, the kind and the number, e.g. "PRIVATNA ZURKA Predracun 40/26"; null when there is none */
  title: string | null;
  items: PurchaseItem[];
  raw: unknown;
}

/** One AI vendor, it only knows how to talk to it; limits and retries are in AiService */
export interface AiProvider {
  extractPurchaseItems(
    file: AiFile,
    drinks: KnownDrink[],
  ): Promise<PurchaseExtraction>;
}

export const PURCHASE_PROMPT =
  'This is a purchase document (invoice, proforma or delivery note) with the drinks that were bought. ' +
  'List every line item as its name and the quantity bought. Ignore everything else: prices, codes, VAT, totals, ' +
  'company data. Keep the name exactly as written on the document. ' +
  'The quantity is a whole number of units. If there are no items, return an empty list. ' +
  'Also read the head of the document, every field is an empty string when it is not on the document: ' +
  'buyerName is the name of the buyer (Kupac) as written, without the customer code or number ' +
  '(for "Kupac: - 28 PRIVATNA ZURKA" it is "PRIVATNA ZURKA"); ' +
  'documentType is the kind of the document as written in its title, without the number ' +
  '(for example "Predracun", "Faktura", "Otpremnica"); ' +
  'documentNumber is the number of the document (for example "40/26").';

/** The prompt with the drinks of the warehouse as they are now (a drink can be added or renamed at any time) */
export const purchasePrompt = (drinks: KnownDrink[]): string =>
  PURCHASE_PROMPT +
  '\n\nThese are the drinks of the warehouse, one per line as "id: name". For every line item set drinkId ' +
  'to the id of the same drink: the same product and the same size and packaging (0.33L is not 0.5L). ' +
  'Names on documents are often shortened or written differently ("CC 0.5 PET" can be "Coca-Cola 0.5L"). ' +
  'Set drinkId to 0 when none of them is the same drink, never guess.\n' +
  (drinks.map((drink) => `${drink.drinkId}: ${drink.name}`).join('\n') ||
    '(no drinks)');

/** The name of the document, e.g. "PRIVATNA ZURKA Predracun 40/26"; null when the AI found none of it */
export const composeTitle = (head: {
  buyerName?: string;
  documentType?: string;
  documentNumber?: string;
}): string | null =>
  [head.buyerName, head.documentType, head.documentNumber]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ') || null;

/** Keeps only valid lines and only drinks that were sent, so a provider can not return rubbish */
export const cleanItems = (
  items: Partial<PurchaseItem>[],
  drinkIds: Set<number>,
): PurchaseItem[] =>
  items
    .map((item) => ({
      name: String(item.name ?? '').trim(),
      quantity: Math.trunc(Number(item.quantity)),
      drinkId: drinkIds.has(Number(item.drinkId)) ? Number(item.drinkId) : null,
    }))
    .filter((item) => item.name && item.quantity > 0);
