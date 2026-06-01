import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/db";
import { upsertManualFixture } from "@/lib/server/fixtures";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

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

  return NextResponse.json({ ok: true });
}
