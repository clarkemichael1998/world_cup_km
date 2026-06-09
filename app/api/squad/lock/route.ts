import { NextResponse } from "next/server";
import { getAllPlayers, getCurrentUser, getLockedSquadForDate, getUpcomingFixtures, lockSquadForDate, unlockSquadForDate } from "@/lib/server/db";
import { syncFixtureResults } from "@/lib/server/fixtures";
import { settleUserLive } from "@/lib/server/live";
import type { Player } from "@/lib/types";

// Returns the "next" lock window — always the next 11am London that hasn't passed yet
function nextLockWindow(now = new Date()) {
  const londonParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(now);
  const parts = Object.fromEntries(londonParts.map((p) => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);

  // If before 11am, the next lock is today at 11am; if after 11am, next lock is tomorrow at 11am
  const lockDate = currentMinutes < 11 * 60 ? today : addDays(today, 1);
  return { lockDate, lockAt: zonedLondonDate(lockDate, 11), unlockAt: zonedLondonDate(addDays(lockDate, 1), 11) };
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function zonedLondonDate(date: string, hour: number) {
  const utcGuess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00.000Z`);
  const londonHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(utcGuess));
  return new Date(utcGuess.getTime() - (londonHour - hour) * 3600000);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  await syncFixtureResults();
  settleUserLive(user.id);
  const window = nextLockWindow();
  const locked = getLockedSquadForDate(user.id, window.lockDate);
  const fixtures = getUpcomingFixtures(window.lockDate);
  const playerMap = new Map((getAllPlayers() as Player[]).map((p) => [p.id, p]));
  const lockedPlayers = locked
    ? locked.players.map(({ slot, player_id }) => {
        const p = playerMap.get(player_id);
        return p ? { slot, player: { id: p.id, name: p.name, nation: p.nation, rating: p.rating } } : null;
      }).filter(Boolean)
    : [];

  return NextResponse.json({
    lockDate: window.lockDate,
    lockAt: window.lockAt.toISOString(),
    unlockAt: window.unlockAt.toISOString(),
    isLocked: Boolean(locked),
    lockedPlayers,
    upcomingFixtures: fixtures.map((f) => ({
      matchId: f.match_id,
      homeTeam: f.home_team,
      awayTeam: f.away_team,
      kickoffAt: f.kickoff_at,
      status: f.status,
      winner: f.winner
    }))
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const window = nextLockWindow();
  lockSquadForDate(user.id, window.lockDate, window.lockAt.toISOString(), window.unlockAt.toISOString());
  return NextResponse.json({
    ok: true,
    lockDate: window.lockDate,
    message: `Your XI is locked for ${window.lockDate}.`
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const window = nextLockWindow();
  unlockSquadForDate(user.id, window.lockDate);
  return NextResponse.json({ ok: true, message: `Your XI is unlocked for ${window.lockDate}.` });
}
