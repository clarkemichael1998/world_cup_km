import { NextResponse } from "next/server";
import { getCurrentUser, getLastMileAwards } from "@/lib/server/db";
import { isAdminUsername } from "@/lib/server/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminUsername(user.username)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  return NextResponse.json({ awards: getLastMileAwards() });
}
