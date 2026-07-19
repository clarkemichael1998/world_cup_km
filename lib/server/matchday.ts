const LOCK_HOUR = 15;

export function getLondonMatchday(now: Date): string {
  const parts = londonParts(now);
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  return currentMinutes >= LOCK_HOUR * 60 ? today : addDays(today, -1);
}

export function londonLockWindow(now: Date) {
  const lockDate = getLondonMatchday(now);
  return londonLockWindowForDate(lockDate);
}

export function londonLockWindowForDate(lockDate: string) {
  const nextDate = addDays(lockDate, 1);
  // Final matchday closes at 11pm BST on its own day (app lockdown), not 3pm the next day
  const unlockAt = lockDate === "2026-07-19"
    ? zonedLondonDate(lockDate, 23)
    : zonedLondonDate(nextDate, LOCK_HOUR);
  return {
    lockDate,
    lockAt: zonedLondonDate(lockDate, LOCK_HOUR),
    unlockAt
  };
}

function londonParts(now: Date) {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  return Object.fromEntries(formatted.map((part) => [part.type, part.value]));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function zonedLondonDate(date: string, hour: number) {
  const utcGuess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00.000Z`);
  const noonUtc = new Date(`${date}T12:00:00.000Z`);
  const londonNoonParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(noonUtc);
  const parts = Object.fromEntries(londonNoonParts.map((part) => [part.type, part.value]));
  const londonNoonAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  const offsetMs = londonNoonAsUtc - noonUtc.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}
