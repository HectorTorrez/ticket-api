import { parseDurationMs } from './duration';

describe('parseDurationMs', () => {
  it('parses seconds, minutes, hours and days', () => {
    expect(parseDurationMs('30s')).toBe(30_000);
    expect(parseDurationMs('15m')).toBe(15 * 60_000);
    expect(parseDurationMs('2h')).toBe(2 * 3_600_000);
    expect(parseDurationMs('7d')).toBe(7 * 86_400_000);
  });

  it('is case-insensitive and trims input', () => {
    expect(parseDurationMs('  10M  ')).toBe(10 * 60_000);
  });

  it('falls back to 7 days for invalid input', () => {
    expect(parseDurationMs('')).toBe(7 * 86_400_000);
    expect(parseDurationMs('abc')).toBe(7 * 86_400_000);
    expect(parseDurationMs('15')).toBe(7 * 86_400_000);
  });
});
