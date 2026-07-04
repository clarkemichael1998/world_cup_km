import { NextResponse } from "next/server";
import {
  cancelTradeOffer,
  confirmTradeProposal,
  createTradeOffer,
  declineTradeProposal,
  getCurrentUser,
  getDb,
  getOpenTradeOffers,
  getPendingProposalsForOpenOffers,
  getRecentCompletedTrades,
  proposeTrade,
  withdrawTradeProposal
} from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const proposals = getPendingProposalsForOpenOffers();
  const proposalsByOffer = new Map<number, Array<{ id: number; username: string; playerId: number; isMine: boolean }>>();
  for (const proposal of proposals) {
    const list = proposalsByOffer.get(proposal.offer_id) ?? [];
    list.push({ id: proposal.id, username: proposal.username, playerId: proposal.player_id, isMine: proposal.user_id === user.id });
    proposalsByOffer.set(proposal.offer_id, list);
  }

  const openOffers = getOpenTradeOffers();
  const tradeUsers = [...new Set(openOffers.map((offer) => offer.user_id))];
  const ownershipByUser = new Map<number, Array<{ playerId: number; duplicateCount: number }>>();

  if (tradeUsers.length > 0) {
    const placeholders = tradeUsers.map(() => "?").join(",");
    const rows = getDb()
      .prepare(`SELECT user_id, player_id, duplicate_count FROM user_players WHERE user_id IN (${placeholders})`)
      .all(...tradeUsers) as Array<{ user_id: number; player_id: number; duplicate_count: number }>;

    for (const row of rows) {
      const list = ownershipByUser.get(row.user_id) ?? [];
      list.push({ playerId: row.player_id, duplicateCount: row.duplicate_count });
      ownershipByUser.set(row.user_id, list);
    }
  }

  return NextResponse.json({
    offers: openOffers.map((offer) => {
      const ownership = ownershipByUser.get(offer.user_id) ?? [];
      return {
        id: offer.id,
        username: offer.username,
        playerId: offer.player_id,
        createdAt: offer.created_at,
        isMine: offer.user_id === user.id,
        spareCount: ownership.find((owned) => owned.playerId === offer.player_id)?.duplicateCount ?? 0,
        offererOwnedPlayerIds: ownership.map((owned) => owned.playerId),
        offererDuplicateCounts: Object.fromEntries(ownership.map((owned) => [owned.playerId, owned.duplicateCount])),
        proposals: proposalsByOffer.get(offer.id) ?? []
      };
    }),
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

  const body = (await request.json().catch(() => null)) as { action?: string; offerId?: number; playerId?: number; proposalId?: number } | null;
  if (!body?.action) return NextResponse.json({ error: "Action required." }, { status: 400 });

  let error: string | null;
  switch (body.action) {
    case "create":
      if (typeof body.playerId !== "number") return NextResponse.json({ error: "playerId required." }, { status: 400 });
      error = createTradeOffer(user.id, body.playerId);
      break;
    case "cancel":
      if (typeof body.offerId !== "number") return NextResponse.json({ error: "offerId required." }, { status: 400 });
      error = cancelTradeOffer(user.id, body.offerId);
      break;
    case "propose":
      if (typeof body.offerId !== "number" || typeof body.playerId !== "number") {
        return NextResponse.json({ error: "offerId and playerId required." }, { status: 400 });
      }
      error = proposeTrade(body.offerId, user.id, body.playerId);
      break;
    case "withdraw":
      if (typeof body.proposalId !== "number") return NextResponse.json({ error: "proposalId required." }, { status: 400 });
      error = withdrawTradeProposal(user.id, body.proposalId);
      break;
    case "decline":
      if (typeof body.proposalId !== "number") return NextResponse.json({ error: "proposalId required." }, { status: 400 });
      error = declineTradeProposal(user.id, body.proposalId);
      break;
    case "confirm":
      if (typeof body.proposalId !== "number") return NextResponse.json({ error: "proposalId required." }, { status: 400 });
      error = confirmTradeProposal(user.id, body.proposalId);
      break;
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
