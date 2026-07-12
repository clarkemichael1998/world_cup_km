import { NextResponse } from "next/server";
import { getCurrentUser, getLastMileAwards, adminAwardLastMileCard, repairLastMileMissingUserPlayers } from "@/lib/server/db";
import { isAdminUsername } from "@/lib/server/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminUsername(user.username)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  return NextResponse.json({ awards: getLastMileAwards() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminUsername(user.username)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { action?: string; username?: string; playerId?: number; sprintDate?: string } | null;

  if (body?.action === "repair") {
    const count = repairLastMileMissingUserPlayers();
    return NextResponse.json({ ok: true, repaired: count, awards: getLastMileAwards() });
  }

  if (body?.action === "award") {
    if (!body.username || !body.playerId || !body.sprintDate) {
      return NextResponse.json({ error: "username, playerId, and sprintDate required." }, { status: 400 });
    }
    const result = adminAwardLastMileCard(body.username, body.playerId, body.sprintDate);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, awards: getLastMileAwards() });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
