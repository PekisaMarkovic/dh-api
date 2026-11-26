/**
 * Where an order from the site is: new until the courier of the shop takes it (in progress), then delivered.
 * It can be cancelled (the buyer gets an email then). An employee can set any status, also back after a wrong click.
 */
export enum OrderStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}
