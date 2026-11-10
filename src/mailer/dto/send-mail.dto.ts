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
