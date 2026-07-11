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
  return {
    lockDate,
    lockAt: zonedLondonDate(lockDate, LOCK_HOUR),
    unlockAt: zonedLondonDate(nextDate, LOCK_HOUR)
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
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false
    }).format(utcGuess)
  );
  const offsetHours = londonHour - hour;
  return new Date(utcGuess.getTime() - offsetHours * 60 * 60 * 1000);
}
