import { NextResponse } from "next/server";
import { getCurrentUser, getNewsReel, updateNewsReel } from "@/lib/server/db";
import { isAdminUsername } from "@/lib/server/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ news: getNewsReel() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { message?: string; isActive?: boolean } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: "News message is required." }, { status: 400 });

  const news = updateNewsReel(message, body?.isActive !== false, user.id);
  return NextResponse.json({ ok: true, news });
}
