import { NextResponse } from "next/server";
import { getCurrentUser, getKmFeed, getKmLogsToday, logKmEntry } from "@/lib/server/db";
import { getKmMultiplier } from "@/lib/rewardEngine";

const MAX_LOGS_PER_DAY = 3;
const MAX_KM_PER_LOG = 50;
const WC_FINAL_LOCKOUT = new Date("2026-07-19T18:00:00Z");

export async function GET() {
  return NextResponse.json({ feed: getKmFeed() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  if (new Date() >= WC_FINAL_LOCKOUT) {
    return NextResponse.json({ error: "KM logging is locked — the World Cup Final has kicked off!" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { distanceKm?: number; cardsEarned?: number } | null;
  if (!body || typeof body.distanceKm !== "number" || body.distanceKm <= 0) {
    return NextResponse.json({ error: "Invalid entry." }, { status: 400 });
  }

  if (body.distanceKm > MAX_KM_PER_LOG) {
    return NextResponse.json({ error: `Maximum ${MAX_KM_PER_LOG}km per log.` }, { status: 400 });
  }

  const logsToday = getKmLogsToday(user.id);
  if (logsToday >= MAX_LOGS_PER_DAY) {
    return NextResponse.json({ error: `You've reached the limit of ${MAX_LOGS_PER_DAY} logs per day. Come back tomorrow!` }, { status: 400 });
  }

  const multiplier = getKmMultiplier();
  logKmEntry(user.id, body.distanceKm, body.cardsEarned ?? 0);
  return NextResponse.json({ ok: true, logsRemaining: MAX_LOGS_PER_DAY - logsToday - 1, multiplier });
}
