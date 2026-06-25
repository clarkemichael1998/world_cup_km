import { NextResponse } from "next/server";
import { getAllPlayers, getCurrentUser, spendCreditsForPlayers } from "@/lib/server/db";
import { getRandomPlayerFromPool } from "@/lib/rewardEngine";

const MAX_REDEEM_PER_REQUEST = 20;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { amount?: number } | null;
  const amount = Math.min(Math.max(1, Math.floor(body?.amount ?? 1)), MAX_REDEEM_PER_REQUEST);

  // Cup Legend cards (cupId set) are exclusive prizes, never randomly pullable.
  const allPlayers = getAllPlayers().filter((player) => !player.cupId);
  const players = Array.from({ length: amount }, () => getRandomPlayerFromPool(allPlayers));
  const playerIds = players.map((p) => p.id);

  const ok = spendCreditsForPlayers(user.id, amount, playerIds);
  if (!ok) return NextResponse.json({ error: "Not enough credits." }, { status: 400 });

  return NextResponse.json({ ok: true, playerIds });
}
