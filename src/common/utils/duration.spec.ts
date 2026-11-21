import { durationToMs } from '@/common/utils/duration';

describe('durationToMs', () => {
  it.each([
    ['45s', 45_000],
    ['30m', 1_800_000],
    ['2h', 7_200_000],
    ['1d', 86_400_000],
  ])('should turn %s into milliseconds', (value, expected) => {
    expect(durationToMs(value, 0)).toBe(expected);
  });

  it('should read a number as seconds, like jsonwebtoken does', () => {
    expect(durationToMs(60, 0)).toBe(60_000);
    expect(durationToMs('60', 0)).toBe(60_000);
  });

  it('should not care about the case or the spaces', () => {
    expect(durationToMs(' 30 M ', 0)).toBe(1_800_000);
  });

  it.each(['abc', '', '1w', '-5m', '1.5h'])(
    'should return the fallback for %p',
    (value) => {
      expect(durationToMs(value, 123)).toBe(123);
    },
  );

  it('should return the fallback when there is no value', () => {
    expect(durationToMs(undefined as unknown as string, 123)).toBe(123);
  });
});
