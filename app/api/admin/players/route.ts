import { NextResponse } from "next/server";
import { createLateCallupPlayer, getCurrentUser, getLateCallupPlayers, MAX_PLAYER_RATING } from "@/lib/server/db";
import { isAdminUsername } from "@/lib/server/admin";
import type { Position } from "@/lib/types";

const positions: Position[] = ["GK", "DF", "MF", "FW"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ players: getLateCallupPlayers() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = validateLateCallup(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const player = createLateCallupPlayer(parsed.input, user.id);
  return NextResponse.json({ ok: true, player, players: getLateCallupPlayers() });
}

function validateLateCallup(body: Record<string, unknown> | null) {
  if (!body) return { error: "Invalid player details." };

  const name = stringValue(body.name);
  const club = stringValue(body.club);
  const nation = stringValue(body.nation);
  const dob = stringValue(body.dob);
  const clubCountry = stringValue(body.clubCountry);
  const teamId = stringValue(body.teamId);
  const pos = stringValue(body.pos) as Position;
  const rating = integerValue(body.rating);
  const caps = nullableIntegerValue(body.caps);
  const goals = nullableIntegerValue(body.goals);
  const wiki = optionalUrl(body.wiki);
  const clubWiki = optionalUrl(body.clubWiki);

  if (!name || name.length < 2) return { error: "Player name must be at least 2 characters." };
  if (!club) return { error: "Club is required." };
  if (!nation) return { error: "Nation is required." };
  if (!positions.includes(pos)) return { error: "Position must be GK, DF, MF, or FW." };
  if (rating === null || rating < 1 || rating > MAX_PLAYER_RATING) return { error: `Rating must be a whole number from 1 to ${MAX_PLAYER_RATING}.` };
  if (!isValidDateOnly(dob)) return { error: "Date of birth must be a valid date." };
  if (caps === "invalid" || goals === "invalid") return { error: "Caps and goals must be whole numbers of 0 or more." };
  if (wiki === "invalid" || clubWiki === "invalid") return { error: "Wiki links must start with http:// or https://." };
  if (!/^[A-Za-z]{2,3}$/.test(clubCountry)) return { error: "Club country must be a 2 or 3 letter code." };
  if (!teamId) return { error: "Team ID is required." };

  return {
    input: {
      name,
      club,
      nation,
      pos,
      rating,
      wiki,
      dob,
      caps,
      goals,
      clubWiki,
      clubCountry,
      teamId
    }
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integerValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(number) ? number : null;
}

function nullableIntegerValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = integerValue(value);
  return number !== null && number >= 0 ? number : "invalid";
}

function optionalUrl(value: unknown) {
  const url = stringValue(value);
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : "invalid";
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
