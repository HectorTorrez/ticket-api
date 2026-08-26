export function isEventEnded(endsAt: Date, now = new Date()): boolean {
  return endsAt <= now;
}
