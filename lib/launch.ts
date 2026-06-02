export const goLiveAt = new Date("2026-06-03T23:00:00.000Z");

export function isPreLaunch(now = new Date()) {
  return now < goLiveAt;
}

export function goLiveLabel() {
  return "Thursday 4 June 2026, 00:00 UK time";
}
