import { NextResponse } from "next/server";
import {
  confirmTradeProposal,
  createDirectTradeProposal,
  declineTradeProposal,
  expireStaleTradeProposals,
  getActiveDirectTradeProposals,
  getAutoTradeMarket,
  getCurrentUser,
  getRecentCompletedTrades,
  withdrawTradeProposal
} from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  expireStaleTradeProposals();

  return NextResponse.json({
    market: getAutoTradeMarket(user.id).map((row) => ({
      userId: row.user_id,
      username: row.username,
      playerId: row.player_id,
      duplicateCount: row.duplicate_count
    })),
    proposals: getActiveDirectTradeProposals(user.id).map((proposal) => ({
      id: proposal.id,
      proposerId: proposal.proposer_id,
      proposerUsername: proposal.proposer_username,
      targetUserId: proposal.target_user_id,
      targetUsername: proposal.target_username,
      wantedPlayerId: proposal.wanted_player_id,
      offeredPlayerId: proposal.offered_player_id,
      createdAt: proposal.created_at,
      expiresAt: proposal.expires_at,
      isMine: proposal.proposer_id === user.id,
      isIncoming: proposal.target_user_id === user.id
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

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    targetUserId?: number;
    wantedPlayerId?: number;
    offeredPlayerId?: number;
    proposalId?: number;
  } | null;
  if (!body?.action) return NextResponse.json({ error: "Action required." }, { status: 400 });

  expireStaleTradeProposals();

  let error: string | null;
  switch (body.action) {
    case "propose":
      if (typeof body.targetUserId !== "number" || typeof body.wantedPlayerId !== "number" || typeof body.offeredPlayerId !== "number") {
        return NextResponse.json({ error: "targetUserId, wantedPlayerId and offeredPlayerId required." }, { status: 400 });
      }
      error = createDirectTradeProposal(user.id, body.targetUserId, body.wantedPlayerId, body.offeredPlayerId);
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
