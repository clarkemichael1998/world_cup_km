import { NextResponse } from "next/server";
import { getChatMessages, getCurrentUser, saveChatMessage } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json({ messages: getChatMessages().reverse() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim() ?? "";
  if (!message) return NextResponse.json({ error: "Message required." }, { status: 400 });
  if (message.length > 500) return NextResponse.json({ error: "Keep messages under 500 characters." }, { status: 400 });

  saveChatMessage(user.id, message);
  return NextResponse.json({ ok: true, messages: getChatMessages().reverse() });
}
