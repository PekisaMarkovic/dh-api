export interface MailAddress {
  name?: string;
  address: string;
}

export interface SendMailDto {
  recipients: MailAddress[];
  data: Record<string, string>;
}

export interface BrevoSendOptions {
  to: MailAddress[];
  subject: string;
  html: string;
}

export interface BrevoSendResult {
  // true when nothing was sent because no API key is configured (development only)
  skipped: boolean;
  messageId?: string;
}

export interface StockDigestItem {
  name: string;
  code: string;
  warehouseName: string;
  quantity: number;
  // the quantity it fell below
  threshold: number;
}

export interface StockDigestRecipient extends MailAddress {
  // the language of the person, the email is written in it (sr / en)
  language?: string;
}

export interface StockDigestMailDto {
  recipients: StockDigestRecipient[];
  // below the "has to be bought again" quantity (red)
  critical: StockDigestItem[];
  // below the warning quantity (orange)
  warning: StockDigestItem[];
}

export interface OrderMailItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderMailDto {
  orderId: number;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  // the day of the delivery, "2026-11-27"
  pickupDate: string;
  total: number;
  items: OrderMailItem[];
  // the name and the phone of the site (the shop), the buyer sees them
  siteName: string;
  sitePhone: string | null;
  // the employees of the company
  recipients: MailAddress[];
}

export interface OrderCancelledMailDto
  extends Omit<OrderMailDto, 'recipients'> {
  // why, null when the employee did not write it
  reason: string | null;
}
