import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/db";
import { syncFixtureResults } from "@/lib/server/fixtures";
import { getLiveStatus } from "@/lib/server/live";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  await syncFixtureResults();
  return NextResponse.json({ user, live: getLiveStatus(user.id) });
}
