import { NextResponse } from "next/server";
import { getCurrentUser, spendCredits, saveRevealPlayerIds } from "@/lib/server/db";
import { rollRarity, getRandomPlayerByRarity } from "@/lib/rewardEngine";

const MAX_REDEEM_PER_REQUEST = 20;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { amount?: number } | null;
  const amount = Math.min(Math.max(1, Math.floor(body?.amount ?? 1)), MAX_REDEEM_PER_REQUEST);

  const ok = spendCredits(user.id, amount);
  if (!ok) return NextResponse.json({ error: "Not enough credits." }, { status: 400 });

  const players = Array.from({ length: amount }, () => getRandomPlayerByRarity(rollRarity()));
  saveRevealPlayerIds(user.id, players.map((p) => p.id));

  return NextResponse.json({ ok: true, playerIds: players.map((p) => p.id) });
}
