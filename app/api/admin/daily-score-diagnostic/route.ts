import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/server/admin";
import { getCurrentUser, getDailyScoreDiagnostic } from "@/lib/server/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const username = params.get("username") ?? "";
  const date = params.get("date") ?? "";
  if (!username.trim()) return NextResponse.json({ error: "username required" }, { status: 400 });
  if (!date.trim()) return NextResponse.json({ error: "date required" }, { status: 400 });

  return NextResponse.json(getDailyScoreDiagnostic(username, date));
}
