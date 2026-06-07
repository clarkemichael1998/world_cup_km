import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/server/admin";
import { getCurrentUser } from "@/lib/server/db";
import { getProviderStatus, syncFixtureResults } from "@/lib/server/fixtures";
import { settleAllLiveAwards } from "@/lib/server/live";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await syncFixtureResults();
  const result = settleAllLiveAwards();
  return NextResponse.json({ ok: true, ...result, providerStatus: getProviderStatus() });
}
