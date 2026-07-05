import { NextResponse } from "next/server";
import { getCurrentUser, getCupDraw, setCupDraw } from "@/lib/server/db";
import { getAdminUsernames } from "@/lib/server/admin";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  const admins = getAdminUsernames();
  return admins.has(user.username.toLowerCase()) ? user : null;
}

/** GET /api/admin/cup-draws?cupId=1  — view stored draw */
export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const cupId = Number(searchParams.get("cupId"));
  if (!cupId) return NextResponse.json({ error: "cupId required" }, { status: 400 });
  return NextResponse.json({ cupId, draw: getCupDraw(cupId) });
}

/** POST /api/admin/cup-draws  { cupId: 1, participants: ["alice","bob",...] }  — overwrite draw */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { cupId?: number; participants?: string[] } | null;
  if (!body?.cupId || !Array.isArray(body.participants)) {
    return NextResponse.json({ error: "cupId and participants[] required" }, { status: 400 });
  }
  setCupDraw(body.cupId, body.participants);
  return NextResponse.json({ ok: true, cupId: body.cupId, participants: body.participants });
}
