import { NextResponse } from "next/server";
import { claimLastMilePick, getCurrentUser, getLastMileStatus } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const status = getLastMileStatus(user.id);
  // Strip ratings from players not yet claimed — keep the mystery
  const safePlayers = status.players.map((p) => {
    const isClaimed = Object.values(status.claimed).includes(p.id);
    return isClaimed ? p : { ...p, rating: null };
  });
  return NextResponse.json({ ...status, players: safePlayers });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { playerId?: number } | null;
  if (!body?.playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });
  const result = claimLastMilePick(user.id, body.playerId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
