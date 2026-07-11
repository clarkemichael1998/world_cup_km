import { NextResponse } from "next/server";
import { isAppLockedDown } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json({ locked: isAppLockedDown() });
}
