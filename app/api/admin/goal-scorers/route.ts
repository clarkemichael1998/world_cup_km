import { NextResponse } from "next/server";
import { getCurrentUser, getPendingGoalScorers, resolveGoalScorer, upsertGoalScorer, getPendingAssistScorers, resolveAssistScorer, upsertAssistScorer } from "@/lib/server/db";
import { findBestPlayerMatch } from "@/lib/server/goalScorers";

function isAdmin(username: string) {
  return process.env.ADMIN_USERNAME && username === process.env.ADMIN_USERNAME;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdmin(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ goalScorers: getPendingGoalScorers(), assistScorers: getPendingAssistScorers() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdmin(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    const status = body.playerId != null ? "matched" : "ignored";
    if (isAssist) resolveAssistScorer(body.id, body.playerId ?? null, status);
    else resolveGoalScorer(body.id, body.playerId ?? null, status);
    return NextResponse.json({ ok: true });
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
    return NextResponse.json({ ok: true, matchedPlayer: match?.player ?? null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
