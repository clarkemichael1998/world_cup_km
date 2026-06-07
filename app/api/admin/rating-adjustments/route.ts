import { NextResponse } from "next/server";
import { createPlayerRatingAdjustment, getCurrentUser, getPlayerRatingAdjustments } from "@/lib/server/db";
import { isAdminUsername } from "@/lib/server/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ adjustments: getPlayerRatingAdjustments() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { playerId?: unknown; adjustment?: unknown; reason?: unknown } | null;
  const playerId = integerValue(body?.playerId);
  const adjustment = integerValue(body?.adjustment);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!playerId || playerId < 1) return NextResponse.json({ error: "Choose a valid player." }, { status: 400 });
  if (!adjustment || adjustment < -20 || adjustment > 20) return NextResponse.json({ error: "Adjustment must be a whole number from -20 to +20." }, { status: 400 });
  if (reason.length < 3) return NextResponse.json({ error: "Reason must be at least 3 characters." }, { status: 400 });

  const created = createPlayerRatingAdjustment(playerId, adjustment, reason, user.id);
  if (!created) return NextResponse.json({ error: "Could not apply that rating change." }, { status: 400 });

  return NextResponse.json({ ok: true, adjustment: created, adjustments: getPlayerRatingAdjustments() });
}

function integerValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(number) ? number : null;
}
