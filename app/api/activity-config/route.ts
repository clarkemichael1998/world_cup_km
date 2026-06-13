import { NextResponse } from "next/server";
import { getActivityMultiplier } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json({ multiplier: getActivityMultiplier() });
}
