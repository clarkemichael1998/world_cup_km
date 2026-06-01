import { NextResponse } from "next/server";
import { getCurrentUser, getPersistedUserState, savePersistedUserState } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  return NextResponse.json({ state: getPersistedUserState(user.id) });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.state) return NextResponse.json({ error: "Missing state." }, { status: 400 });

  savePersistedUserState(user.id, body.state);
  return NextResponse.json({ ok: true });
}
