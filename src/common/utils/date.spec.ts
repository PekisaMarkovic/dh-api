import { formatDateYearMonthDay } from '@/common/utils/date';

describe('formatDateYearMonthDay', () => {
  it('should write a date as year-month-day with two digits for the month and the day', () => {
    expect(formatDateYearMonthDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('should read a text and a number as a date', () => {
    expect(formatDateYearMonthDay('2026-11-21T12:00:00')).toBe('2026-11-21');
    expect(formatDateYearMonthDay(new Date(2026, 10, 21).getTime())).toBe(
      '2026-11-21',
    );
  });

  it('should throw for anything else', () => {
    expect(() => formatDateYearMonthDay(null as unknown as Date)).toThrow(
      'Invalid input type',
    );
  });
});
