/** Parses strings like `15m`, `7d`, `3600s` into milliseconds (MVP subset). */
export function parseDurationMs(input: string): number {
  const s = input.trim();
  const m = /^(\d+)([smhd])$/i.exec(s);
  if (!m) return 7 * 864e5;
  const n = Number.parseInt(m[1], 10);
  switch (m[2].toLowerCase()) {
    case 's':
      return n * 1000;
    case 'm':
      return n * 60 * 1000;
    case 'h':
      return n * 3600 * 1000;
    case 'd':
      return n * 864e5;
    default:
      return 7 * 864e5;
  }
}
