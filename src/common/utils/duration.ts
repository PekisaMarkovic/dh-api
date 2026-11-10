const UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Converts "30m", "2h", "45s", "1d" (the same strings JWT_EXPIRE uses)
 * to milliseconds. A plain number is read as seconds, like jsonwebtoken does.
 */
export const durationToMs = (value: string | number, fallbackMs: number) => {
  if (typeof value === 'number') {
    return value * 1000;
  }

  const match = /^\s*(\d+)\s*([smhd])?\s*$/i.exec(value ?? '');

  if (!match) {
    return fallbackMs;
  }

  return Number(match[1]) * UNITS[(match[2] ?? 's').toLowerCase()];
};
