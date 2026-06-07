import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/server/admin";
import { getAdminMatchMonitor, getCurrentUser } from "@/lib/server/db";
import { syncFixtureResults } from "@/lib/server/fixtures";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await syncFixtureResults();
  return NextResponse.json(getAdminMatchMonitor());
}
