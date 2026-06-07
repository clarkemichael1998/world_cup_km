import { NextResponse } from "next/server";
import { createAdminChatMessage, getCurrentUser } from "@/lib/server/db";
import { isAdminUsername } from "@/lib/server/admin";
import { upsertManualFixture } from "@/lib/server/fixtures";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    matchId?: string;
    matchDate?: string;
    kickoffAt?: string;
    homeTeam?: string;
    awayTeam?: string;
    winner?: string | null;
    status?: "SCHEDULED" | "LIVE" | "FINISHED";
  } | null;

  if (!body?.matchId || !body.matchDate || !body.kickoffAt || !body.homeTeam || !body.awayTeam || !body.status) {
    return NextResponse.json({ error: "Missing result fields." }, { status: 400 });
  }

  upsertManualFixture({
    matchId: body.matchId,
    matchDate: body.matchDate,
    kickoffAt: body.kickoffAt,
    homeTeam: body.homeTeam,
    awayTeam: body.awayTeam,
    winner: body.winner ?? null,
    status: body.status
  });

  const resultText = body.status === "FINISHED"
    ? body.winner
      ? `${body.winner} confirmed as winner`
      : "Draw confirmed"
    : `${body.status.toLowerCase()} status confirmed`;
  createAdminChatMessage(`Admin confirmed result: ${body.homeTeam} vs ${body.awayTeam} — ${resultText}.`);

  return NextResponse.json({ ok: true });
}
