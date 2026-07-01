import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/server/admin";
import { settleCupRewards } from "@/lib/server/cups";
import { getCurrentUser } from "@/lib/server/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = settleCupRewards();
  return NextResponse.json({
    ok: true,
    awarded: result.awarded,
    alreadyAwarded: result.alreadyAwarded,
    awardedCount: result.awarded.length,
    alreadyAwardedCount: result.alreadyAwarded.length
  });
}
