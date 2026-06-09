import { NextResponse } from "next/server";
import { acceptTradeOffer, cancelTradeOffer, createTradeOffer, getCurrentUser, getOpenTradeOffers, getRecentCompletedTrades } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  return NextResponse.json({
    offers: getOpenTradeOffers().map((offer) => ({
      id: offer.id,
      username: offer.username,
      playerId: offer.player_id,
      createdAt: offer.created_at,
      isMine: offer.user_id === user.id
    })),
    recent: getRecentCompletedTrades().map((trade) => ({
      offererUsername: trade.offerer_username,
      acceptorUsername: trade.acceptor_username,
      playerId: trade.player_id,
      acceptedPlayerId: trade.accepted_player_id,
      completedAt: trade.completed_at
    }))
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { action?: "create"; playerId?: number }
    | { action?: "cancel"; offerId?: number }
    | { action?: "accept"; offerId?: number; playerId?: number }
    | null;
  if (!body?.action) return NextResponse.json({ error: "Action required." }, { status: 400 });

  let error: string | null = null;
  if (body.action === "create") {
    if (typeof body.playerId !== "number") return NextResponse.json({ error: "playerId required." }, { status: 400 });
    error = createTradeOffer(user.id, body.playerId);
  } else if (body.action === "cancel") {
    if (typeof body.offerId !== "number") return NextResponse.json({ error: "offerId required." }, { status: 400 });
    error = cancelTradeOffer(user.id, body.offerId);
  } else if (body.action === "accept") {
    if (typeof body.offerId !== "number" || typeof body.playerId !== "number") {
      return NextResponse.json({ error: "offerId and playerId required." }, { status: 400 });
    }
    error = acceptTradeOffer(body.offerId, user.id, body.playerId);
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
