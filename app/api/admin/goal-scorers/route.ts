import { NextResponse } from "next/server";
import {
  deleteAssistScorer,
  deleteGoalScorer,
  getBoostLog,
  getCompletedGamesWithScorers,
  getCurrentUser,
  getPendingGoalScorers,
  resolveGoalScorer,
  setScorersConfirmed,
  upsertGoalScorer,
  getPendingAssistScorers,
  resolveAssistScorer,
  upsertAssistScorer
} from "@/lib/server/db";
import { isAdminUsername } from "@/lib/server/admin";
import { findBestPlayerMatch, getPlayerById } from "@/lib/server/goalScorers";
import { settleAllLiveAwards } from "@/lib/server/live";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    games: getCompletedGamesWithScorers(),
    goalScorers: getPendingGoalScorers(),
    assistScorers: getPendingAssistScorers(),
    boostLog: getBoostLog()
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    eventType?: "goal" | "assist";
    id?: number;
    playerId?: number | null;
    matchId?: string;
    scorerName?: string;
    count?: number;
  } | null;

  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });
  const isAssist = body.eventType === "assist";

  if (body.action === "resolve") {
    if (typeof body.id !== "number") return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const existing = isAssist
      ? getPendingAssistScorers().find((row) => row.id === body.id)
      : getPendingGoalScorers().find((row) => row.id === body.id);
    const status = body.playerId != null ? "matched" : "ignored";
    if (isAssist) resolveAssistScorer(body.id, body.playerId ?? null, status);
    else resolveGoalScorer(body.id, body.playerId ?? null, status);
    const settle = settleAllLiveAwards();
    return NextResponse.json({ ok: true, usersSettled: settle.usersSettled });
  }

  if (body.action === "add") {
    if (!body.matchId || !body.scorerName) return NextResponse.json({ error: "Missing matchId or scorerName" }, { status: 400 });
    const match = findBestPlayerMatch(body.scorerName);
    const count = Math.max(1, Math.min(10, body.count ?? 1));
    if (isAssist) {
      upsertAssistScorer(body.matchId, body.scorerName, match?.player.id ?? null, match ? "matched" : "pending", "manual", count);
    } else {
      upsertGoalScorer(body.matchId, body.scorerName, match?.player.id ?? null, match ? "matched" : "pending", "manual", count);
    }
    if (match) settleAllLiveAwards();
    return NextResponse.json({ ok: true, matchedPlayer: match?.player ?? null });
  }

  // Pick the exact player from a dropdown — no fuzzy matching needed.
  if (body.action === "addByPlayer") {
    if (!body.matchId || typeof body.playerId !== "number") return NextResponse.json({ error: "Missing matchId or playerId" }, { status: 400 });
    const player = getPlayerById(body.playerId);
    if (!player) return NextResponse.json({ error: "Unknown player" }, { status: 400 });
    const count = Math.max(1, Math.min(10, body.count ?? 1));
    if (isAssist) {
      upsertAssistScorer(body.matchId, player.name, player.id, "matched", "manual", count);
    } else {
      upsertGoalScorer(body.matchId, player.name, player.id, "matched", "manual", count);
    }
    const settle = settleAllLiveAwards();
    return NextResponse.json({ ok: true, player: { id: player.id, name: player.name }, usersSettled: settle.usersSettled });
  }

  if (body.action === "remove") {
    if (typeof body.id !== "number") return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const removed = isAssist ? deleteAssistScorer(body.id) : deleteGoalScorer(body.id);
    if (removed) settleAllLiveAwards();
    return NextResponse.json({ ok: removed });
  }

  if (body.action === "confirm" || body.action === "reopen") {
    if (!body.matchId) return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
    setScorersConfirmed(body.matchId, body.action === "confirm");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
