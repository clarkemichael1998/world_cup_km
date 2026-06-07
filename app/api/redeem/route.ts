import { NextResponse } from "next/server";
import { getAllPlayers, getCurrentUser, spendCreditsForPlayers } from "@/lib/server/db";
import { rollRarity } from "@/lib/rewardEngine";
import type { Player, Rarity } from "@/lib/types";

const MAX_REDEEM_PER_REQUEST = 20;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { amount?: number } | null;
  const amount = Math.min(Math.max(1, Math.floor(body?.amount ?? 1)), MAX_REDEEM_PER_REQUEST);

  const allPlayers = getAllPlayers();
  const players = Array.from({ length: amount }, () => getRandomPlayerByRarity(allPlayers, rollRarity()));
  const playerIds = players.map((p) => p.id);

  const ok = spendCreditsForPlayers(user.id, amount, playerIds);
  if (!ok) return NextResponse.json({ error: "Not enough credits." }, { status: 400 });

  return NextResponse.json({ ok: true, playerIds });
}

function getRandomPlayerByRarity(allPlayers: Player[], rarity: Rarity): Player {
  const pool = allPlayers.filter((player) => player.rarity === rarity);
  const fallbackPool = pool.length > 0 ? pool : allPlayers;
  return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
}
