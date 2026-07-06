import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/server/admin";
import { reverseCupRewardSettlement, settleCupRewards } from "@/lib/server/cups";
import { getCurrentUser } from "@/lib/server/db";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { action?: string; cupId?: number; createdDate?: string; reason?: string };
  const cupId = Number(body.cupId);
  if (!Number.isInteger(cupId) || cupId < 1 || cupId > 4) {
    return NextResponse.json({ error: "Select one cup to settle." }, { status: 400 });
  }

  if (body.action === "reverse") {
    const createdDate = typeof body.createdDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.createdDate)
      ? body.createdDate
      : new Date().toISOString().slice(0, 10);
    return NextResponse.json({
      ok: true,
      reversed: reverseCupRewardSettlement(cupId, createdDate, body.reason ?? "Admin reversed mistaken cup settlement.")
    });
  }

  const result = settleCupRewards(cupId);
  return NextResponse.json({
    ok: true,
    awarded: result.awarded,
    alreadyAwarded: result.alreadyAwarded,
    awardedCount: result.awarded.length,
    alreadyAwardedCount: result.alreadyAwarded.length
  });
}
