import { isPickupDateAllowed, pickupDateRange } from '@/orders/pickup-date';

describe('pickup date', () => {
  // the moments are in UTC, Serbia is UTC+1 in the winter and UTC+2 in the summer
  const winter = (iso: string) => new Date(`${iso}+01:00`);
  const summer = (iso: string) => new Date(`${iso}+02:00`);

  it('should start today before 15:00 in Serbia', () => {
    expect(pickupDateRange(winter('2026-11-26T14:59:00')).first).toBe(
      '2026-11-26',
    );
  });

  it('should start tomorrow from 15:00 in Serbia', () => {
    expect(pickupDateRange(winter('2026-11-26T15:00:00')).first).toBe(
      '2026-11-27',
    );
  });

  it('should use the time of Serbia, also in the summer', () => {
    // 14:30 in Belgrade is 12:30 UTC
    expect(pickupDateRange(summer('2026-07-10T14:30:00')).first).toBe(
      '2026-07-10',
    );
    expect(pickupDateRange(summer('2026-07-10T15:30:00')).first).toBe(
      '2026-07-11',
    );
  });

  it('should go to the next year after 15:00 on 31 December', () => {
    expect(pickupDateRange(winter('2026-12-31T16:00:00')).first).toBe(
      '2027-01-01',
    );
  });

  it('should end one month after today', () => {
    expect(pickupDateRange(winter('2026-11-26T10:00:00')).last).toBe(
      '2026-12-26',
    );
  });

  it('should end on the last day of a shorter month', () => {
    expect(pickupDateRange(winter('2026-01-31T10:00:00')).last).toBe(
      '2026-02-28',
    );
  });

  it('should allow the first and the last day, not the days around them', () => {
    const now = winter('2026-11-26T16:00:00');

    expect(isPickupDateAllowed('2026-11-26', now)).toBe(false);
    expect(isPickupDateAllowed('2026-11-27', now)).toBe(true);
    expect(isPickupDateAllowed('2026-12-26', now)).toBe(true);
    expect(isPickupDateAllowed('2026-12-27', now)).toBe(false);
  });
});
