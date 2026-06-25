import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/server/admin";
import { getCurrentUser, getUserBoostDiagnostic, repairUserGoalBoost } from "@/lib/server/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const username = new URL(request.url).searchParams.get("username") ?? "";
  if (!username.trim()) return NextResponse.json({ error: "username required" }, { status: 400 });

  return NextResponse.json(getUserBoostDiagnostic(username));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { username?: string; playerId?: number; matchDate?: string } | null;
  if (!body?.username?.trim()) return NextResponse.json({ error: "username required" }, { status: 400 });
  if (typeof body.playerId !== "number") return NextResponse.json({ error: "playerId required" }, { status: 400 });

  return NextResponse.json(repairUserGoalBoost(body.username, body.playerId, body.matchDate));
}
