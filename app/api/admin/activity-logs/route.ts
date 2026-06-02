import { NextResponse } from "next/server";
import { createAdminChatMessage, getAdminActivityLogs, getCurrentUser, voidActivityLog } from "@/lib/server/db";

function isAdmin(username: string) {
  return process.env.ADMIN_USERNAME && username === process.env.ADMIN_USERNAME;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdmin(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ logs: getAdminActivityLogs() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdmin(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { logId?: number; reason?: string } | null;
  if (!body || typeof body.logId !== "number") return NextResponse.json({ error: "Missing log id." }, { status: 400 });
  const reason = body.reason?.trim();
  if (!reason) return NextResponse.json({ error: "Removal reason is required." }, { status: 400 });

  const result = voidActivityLog(body.logId, user.id, reason);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Could not remove log." }, { status: 400 });
  createAdminChatMessage(`Admin removed activity log #${body.logId}. Reason: ${reason}`);
  return NextResponse.json({ ok: true });
}
