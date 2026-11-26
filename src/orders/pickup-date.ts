/**
 * The day an order is picked up, as a date without time ("2026-11-27"), in the time of Serbia.
 * Today can be picked only before 15:00, after that the first day is tomorrow. At most one month ahead,
 * so nobody orders for a day that is far away (or plays with the form).
 * The site has the same rules (it shows the days that can be picked), the api checks them again.
 */

export const PICKUP_TIME_ZONE = 'Europe/Belgrade';
// from this hour today can no longer be picked
export const PICKUP_CUTOFF_HOUR = 15;
export const PICKUP_MAX_MONTHS_AHEAD = 1;

/** "2026-11-27" and the hour (0 - 23) of a moment, in the time of Serbia */
const belgradeDateAndHour = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PICKUP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    hour: Number(part('hour')),
  };
};

/** "2026-11-27" + 1 day / + 1 month, as a calendar date (no time zone, no summer time) */
const addDays = (date: string, days: number) => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);

  return day.toISOString().slice(0, 10);
};

const addMonths = (date: string, months: number) => {
  const [year, month, day] = date.split('-').map(Number);
  // the last day of the month when the month after has fewer days (31.1. -> 28.2.)
  const lastDay = new Date(
    Date.UTC(year, month - 1 + months + 1, 0),
  ).getUTCDate();

  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
};

/** The first and the last day that can be picked now (both included) */
export const pickupDateRange = (now = new Date()) => {
  const { date: today, hour } = belgradeDateAndHour(now);
  const first = hour < PICKUP_CUTOFF_HOUR ? today : addDays(today, 1);

  return { first, last: addMonths(today, PICKUP_MAX_MONTHS_AHEAD) };
};

/** True when the day can be picked now ("YYYY-MM-DD" strings compare like dates) */
export const isPickupDateAllowed = (date: string, now = new Date()) => {
  const { first, last } = pickupDateRange(now);

  return date >= first && date <= last;
};
