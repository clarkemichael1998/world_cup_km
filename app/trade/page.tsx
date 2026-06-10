"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import { loadUserStateAsync } from "@/lib/storage";
import type { Player, UserState } from "@/lib/types";

type TradeProposal = { id: number; username: string; playerId: number; isMine: boolean };
type TradeOffer = { id: number; username: string; playerId: number; createdAt: string; isMine: boolean; proposals: TradeProposal[] };
type RecentTrade = { offererUsername: string; acceptorUsername: string; playerId: number; acceptedPlayerId: number; completedAt: string };

export default function TradePage() {
  const [state, setState] = useState<UserState | null>(null);
  const [playerPool, setPlayerPool] = useState<Player[]>(basePlayerPool);
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [offerPlayerId, setOfferPlayerId] = useState<number | "">("");
  const [acceptSelections, setAcceptSelections] = useState<Record<number, number>>({});
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeNotice, setTradeNotice] = useState("");

  useEffect(() => {
    loadUserStateAsync().then(setState);
    loadPlayerPool().then(setPlayerPool);
    loadTrades();
  }, []);

  async function loadTrades() {
    try {
      const response = await fetch("/api/trades", { credentials: "include" });
      if (!response.ok) return;
      const payload = await response.json();
      setOffers(payload.offers ?? []);
      setRecentTrades(payload.recent ?? []);
    } catch {}
  }

  async function tradeAction(body: Record<string, unknown>, successNotice: string) {
    if (tradeBusy) return;
    setTradeBusy(true);
    setTradeNotice("");
    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      setTradeNotice(response.ok ? successNotice : payload.error ?? "Trade action failed.");
      await loadTrades();
      const refreshed = await loadUserStateAsync();
      setState(refreshed);
    } finally {
      setTradeBusy(false);
    }
  }

  const playerById = useMemo(() => new Map(playerPool.map((player) => [player.id, player])), [playerPool]);
  const myDuplicates = useMemo(
    () =>
      Object.entries(state?.duplicateCounts ?? {})
        .filter(([, count]) => (count ?? 0) > 0)
        .map(([id]) => playerById.get(Number(id)))
        .filter((player): player is Player => Boolean(player))
        .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)),
    [state, playerById]
  );

  const myOffers = offers.filter((offer) => offer.isMine);
  const otherOffers = offers.filter((offer) => !offer.isMine);

  return (
    <div>
      <PageTitle title="Sticker Trading" subtitle="Swap duplicate stickers one-for-one with the rest of the group." />

      <section className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-amber-800">Offer a Duplicate</p>
        <p className="mt-1 text-xs font-semibold text-amber-700">
          Put a spare up for trade. Others propose one of their duplicates in return, and you confirm the swap you like — one for one. You always keep your placed sticker.
        </p>
        {tradeNotice ? <p className="mt-2 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-900">{tradeNotice}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-950 sm:flex-none"
            value={offerPlayerId}
            onChange={(event) => setOfferPlayerId(event.target.value ? Number(event.target.value) : "")}
          >
            <option value="">{myDuplicates.length > 0 ? "Choose a duplicate to offer..." : "No duplicates to offer"}</option>
            {myDuplicates.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.rating} {player.rarity}, {player.nation}) x{(state?.duplicateCounts[player.id] ?? 0) + 1}
              </option>
            ))}
          </select>
          <button
            onClick={() => offerPlayerId !== "" && tradeAction({ action: "create", playerId: offerPlayerId }, "Offer posted — waiting for a taker.")}
            disabled={tradeBusy || offerPlayerId === ""}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-40"
          >
            Offer for Trade
          </button>
        </div>
        {myDuplicates.length === 0 ? (
          <p className="mt-2 text-xs font-semibold text-amber-700/80">
            You have no duplicates yet. Pull more stickers from{" "}
            <Link href="/add-km" className="underline">
              logging activity
            </Link>{" "}
            or opening packs.
          </p>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Your Offers</p>
          <div className="mt-3 space-y-2">
            {myOffers.length > 0 ? (
              myOffers.map((offer) => (
                <div key={offer.id} className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-sm font-bold text-amber-950">
                      You offer <span className="font-black">{describePlayer(playerById.get(offer.playerId), offer.playerId)}</span>
                    </p>
                    <button
                      onClick={() => tradeAction({ action: "cancel", offerId: offer.id }, "Offer withdrawn.")}
                      disabled={tradeBusy}
                      className="rounded-md bg-amber-200 px-3 py-1.5 text-xs font-black text-amber-900 hover:bg-amber-300 disabled:opacity-40"
                    >
                      Cancel Offer
                    </button>
                  </div>
                  {offer.proposals.length > 0 ? (
                    <div className="mt-2 space-y-1.5 border-t border-amber-200 pt-2">
                      {offer.proposals.map((proposal) => (
                        <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-amber-900">
                            <span className="font-black">{proposal.username}</span> offers {describePlayer(playerById.get(proposal.playerId), proposal.playerId)} in return
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => tradeAction({ action: "confirm", proposalId: proposal.id }, "Trade complete!")}
                              disabled={tradeBusy}
                              className="rounded-md bg-pitch px-3 py-1 text-xs font-black text-white hover:bg-green-800 disabled:opacity-40"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => tradeAction({ action: "decline", proposalId: proposal.id }, "Proposal declined.")}
                              disabled={tradeBusy}
                              className="rounded-md bg-amber-200 px-3 py-1 text-xs font-black text-amber-900 hover:bg-amber-300 disabled:opacity-40"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs font-semibold text-amber-700/75">No proposals yet — hold tight.</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-green-900/55">You have no open offers. Post one above.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Open Offers</p>
          <div className="mt-3 space-y-2">
            {otherOffers.length > 0 ? (
              otherOffers.map((offer) => {
                const myProposal = offer.proposals.find((proposal) => proposal.isMine);
                return (
                  <div key={offer.id} className="rounded-md border border-green-900/10 bg-green-950/5 px-3 py-2">
                    <p className="min-w-0 text-sm font-bold text-green-950">
                      <span className="font-black">{offer.username}</span> offers <span className="font-black">{describePlayer(playerById.get(offer.playerId), offer.playerId)}</span>
                      {offer.proposals.length > 0 ? <span className="ml-2 text-xs font-black text-green-900/55">· {offer.proposals.length} proposal{offer.proposals.length === 1 ? "" : "s"}</span> : null}
                    </p>
                    {myProposal ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-green-900/70">You proposed {describePlayer(playerById.get(myProposal.playerId), myProposal.playerId)} — waiting on {offer.username}</p>
                        <button
                          onClick={() => tradeAction({ action: "withdraw", proposalId: myProposal.id }, "Proposal withdrawn.")}
                          disabled={tradeBusy}
                          className="rounded-md bg-green-950/10 px-3 py-1.5 text-xs font-black text-green-900 hover:bg-green-950/15 disabled:opacity-40"
                        >
                          Withdraw
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          className="min-w-0 flex-1 rounded-md border border-green-900/20 bg-white px-2 py-1.5 text-xs font-bold text-green-950"
                          value={acceptSelections[offer.id] ?? ""}
                          onChange={(event) => setAcceptSelections((prev) => ({ ...prev, [offer.id]: Number(event.target.value) }))}
                        >
                          <option value="">Offer in return...</option>
                          {myDuplicates.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.name} ({player.rating} {player.rarity}, {player.nation})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => acceptSelections[offer.id] && tradeAction({ action: "propose", offerId: offer.id, playerId: acceptSelections[offer.id] }, "Proposal sent — the offerer decides.")}
                          disabled={tradeBusy || !acceptSelections[offer.id]}
                          className="rounded-md bg-pitch px-3 py-1.5 text-xs font-black text-white hover:bg-green-800 disabled:opacity-40"
                        >
                          Propose Swap
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm font-semibold text-green-900/55">No one else has an open offer right now.</p>
            )}
          </div>
        </section>
      </div>

      {recentTrades.length > 0 ? (
        <section className="mt-5 rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Recent Trades</p>
          <div className="mt-2 space-y-1">
            {recentTrades.slice(0, 10).map((trade, index) => (
              <p key={index} className="text-xs font-semibold text-green-900/75">
                🔁 <span className="font-black text-green-950">{trade.offererUsername}</span> swapped {playerById.get(trade.playerId)?.name ?? `Player ${trade.playerId}`} to{" "}
                <span className="font-black text-green-950">{trade.acceptorUsername}</span> for {playerById.get(trade.acceptedPlayerId)?.name ?? `Player ${trade.acceptedPlayerId}`}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function describePlayer(player: Player | undefined, fallbackId: number) {
  return player ? `${player.name} (${player.rating} ${player.rarity}, ${player.nation})` : `Player ${fallbackId}`;
}
