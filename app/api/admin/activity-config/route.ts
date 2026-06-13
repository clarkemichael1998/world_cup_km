import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/server/admin";
import { getActivityMultiplierSetting, getCurrentUser, updateActivityMultiplier } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ setting: getActivityMultiplierSetting() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { multiplier?: number } | null;
  try {
    return NextResponse.json({ ok: true, setting: updateActivityMultiplier(Number(body?.multiplier), user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid multiplier." }, { status: 400 });
  }
}
