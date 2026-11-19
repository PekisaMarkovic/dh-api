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
