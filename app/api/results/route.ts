import { NextResponse } from "next/server";
import { getResultsByDay } from "@/lib/server/db";
import { syncFixtureResults } from "@/lib/server/fixtures";

export async function GET() {
  await syncFixtureResults();
  return NextResponse.json({ days: getResultsByDay() });
}
