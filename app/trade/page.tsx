"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { PageTitle } from "@/components/PageTitle";
import { flagUrl } from "@/lib/flags";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import { loadUserStateAsync } from "@/lib/storage";
import type { Player, UserState } from "@/lib/types";

type TradeProposal = { id: number; username: string; playerId: number; isMine: boolean };
type TradeOffer = { id: number; username: string; playerId: number; createdAt: string; isMine: boolean; proposals: TradeProposal[] };
type RecentTrade = { offererUsername: string; acceptorUsername: string; playerId: number; acceptedPlayerId: number; completedAt: string };

const rarityRing: Record<string, string> = {
  icon: "ring-zinc-400 bg-gradient-to-br from-zinc-50 to-zinc-200",
  legend: "ring-amber-400 bg-gradient-to-br from-amber-50 to-amber-200",
  epic: "ring-fuchsia-400 bg-gradient-to-br from-fuchsia-50 to-fuchsia-200",
  rare: "ring-sky-400 bg-gradient-to-br from-sky-50 to-sky-200",
  common: "ring-slate-300 bg-gradient-to-br from-slate-50 to-slate-200",
  clowns: "ring-red-400 bg-gradient-to-br from-red-50 to-red-200"
};

const rarityBadge: Record<string, string> = {
  icon: "bg-zinc-800 text-white",
  legend: "bg-amber-500 text-amber-950",
  epic: "bg-fuchsia-600 text-white",
  rare: "bg-sky-500 text-white",
  common: "bg-slate-400 text-white",
  clowns: "bg-red-500 text-white"
};

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
  const offerPreview = offerPlayerId !== "" ? playerById.get(offerPlayerId) : undefined;

  return (
    <div>
      <PageTitle title="Sticker Trading" subtitle="Swap duplicate stickers one-for-one with the rest of the group." />

      <ol className="mb-5 grid gap-2 sm:grid-cols-3">
        <HowToStep n={1} title="Offer a spare" text="Put one of your duplicates up for trade." />
        <HowToStep n={2} title="Collect proposals" text="Others propose one of their duplicates in return." />
        <HowToStep n={3} title="Confirm a swap" text="Pick the proposal you like. Done — one for one." />
      </ol>

      {tradeNotice ? <p className="mb-4 rounded-md bg-amber-100 px-3 py-2 text-sm font-black text-amber-900">{tradeNotice}</p> : null}

      <section className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-amber-800">Offer a Duplicate</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-950"
            value={offerPlayerId}
            onChange={(event) => setOfferPlayerId(event.target.value ? Number(event.target.value) : "")}
          >
            <option value="">{myDuplicates.length > 0 ? "Choose a duplicate to offer..." : "No duplicates to offer"}</option>
            {myDuplicates.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {player.rating} {player.rarity} · {player.nation} (x{(state?.duplicateCounts[player.id] ?? 0) + 1})
              </option>
            ))}
          </select>
          {offerPreview ? <StickerChip player={offerPreview} /> : null}
          <Button
            variant="accent"
            className="shrink-0"
            onClick={() => offerPlayerId !== "" && tradeAction({ action: "create", playerId: offerPlayerId }, "Offer posted — waiting for proposals.")}
            disabled={tradeBusy || offerPlayerId === ""}
          >
            Post Offer
          </Button>
        </div>
        {myDuplicates.length === 0 ? (
          <p className="mt-2 text-xs font-semibold text-amber-700/80">
            You have no duplicates yet. Pull more stickers from{" "}
            <Link href="/add-km" className="underline">logging activity</Link> or opening packs.
          </p>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Your Offers</p>
          <div className="mt-3 space-y-3">
            {myOffers.length > 0 ? (
              myOffers.map((offer) => (
                <div key={offer.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StickerCard player={playerById.get(offer.playerId)} fallbackId={offer.playerId} label="You're offering" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => tradeAction({ action: "cancel", offerId: offer.id }, "Offer withdrawn.")}
                      disabled={tradeBusy}
                    >
                      Cancel
                    </Button>
                  </div>
                  {offer.proposals.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-amber-800/80">{offer.proposals.length} proposal{offer.proposals.length === 1 ? "" : "s"} — pick one</p>
                      {offer.proposals.map((proposal) => (
                        <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-2">
                          <StickerCard player={playerById.get(proposal.playerId)} fallbackId={proposal.playerId} label={`${proposal.username} gives`} />
                          <div className="flex items-center gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => tradeAction({ action: "confirm", proposalId: proposal.id }, "Trade complete! 🔁")}
                              disabled={tradeBusy}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => tradeAction({ action: "decline", proposalId: proposal.id }, "Proposal declined.")}
                              disabled={tradeBusy}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-semibold text-amber-700/75">No proposals yet — hold tight.</p>
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
          <div className="mt-3 space-y-3">
            {otherOffers.length > 0 ? (
              otherOffers.map((offer) => {
                const myProposal = offer.proposals.find((proposal) => proposal.isMine);
                return (
                  <div key={offer.id} className="rounded-lg border border-green-900/10 bg-green-950/5 p-3">
                    <StickerCard player={playerById.get(offer.playerId)} fallbackId={offer.playerId} label={`${offer.username} offers`} />
                    {myProposal ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-green-900/10 pt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-green-900/60">You proposed</span>
                          <StickerChip player={playerById.get(myProposal.playerId)} />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => tradeAction({ action: "withdraw", proposalId: myProposal.id }, "Proposal withdrawn.")}
                          disabled={tradeBusy}
                        >
                          Withdraw
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-green-900/10 pt-3">
                        <span className="text-xs font-black uppercase tracking-wide text-green-900/50">Give in return</span>
                        <select
                          className="min-w-0 flex-1 rounded-md border border-green-900/20 bg-white px-2 py-1.5 text-xs font-bold text-green-950"
                          value={acceptSelections[offer.id] ?? ""}
                          onChange={(event) => setAcceptSelections((prev) => ({ ...prev, [offer.id]: Number(event.target.value) }))}
                        >
                          <option value="">Choose a duplicate...</option>
                          {myDuplicates.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.name} · {player.rating} {player.rarity} · {player.nation}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="primary"
                          size="sm"
                          className="shrink-0"
                          onClick={() => acceptSelections[offer.id] && tradeAction({ action: "propose", offerId: offer.id, playerId: acceptSelections[offer.id] }, "Proposal sent — the offerer decides.")}
                          disabled={tradeBusy || !acceptSelections[offer.id]}
                        >
                          Propose
                        </Button>
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
          <div className="mt-3 space-y-2">
            {recentTrades.slice(0, 10).map((trade, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 rounded-md bg-green-950/5 px-3 py-2 text-xs font-bold text-green-950">
                <span className="font-black">{trade.offererUsername}</span>
                <StickerChip player={playerById.get(trade.playerId)} />
                <span className="text-green-900/50">🔁</span>
                <StickerChip player={playerById.get(trade.acceptedPlayerId)} />
                <span className="font-black">{trade.acceptorUsername}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HowToStep({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-green-900/10 bg-white p-3 shadow-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pitch text-sm font-black text-white">{n}</span>
      <div>
        <p className="text-sm font-black text-green-950">{title}</p>
        <p className="text-xs font-semibold text-green-900/60">{text}</p>
      </div>
    </li>
  );
}

// Full card: flag, name, club, rarity-tinted rating badge.
function StickerCard({ player, fallbackId, label }: { player: Player | undefined; fallbackId: number; label: string }) {
  if (!player) {
    return <div className="text-sm font-bold text-green-900/60">{label}: Player {fallbackId}</div>;
  }
  const flag = flagUrl(player.nation);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md ring-2 ${rarityRing[player.rarity] ?? rarityRing.common}`}>
        <span className="text-sm font-black leading-none text-green-950">{player.rating}</span>
        <span className="text-[7px] font-black uppercase leading-none text-green-950/70">{player.pos}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-green-900/45">{label}</p>
        <div className="flex items-center gap-1.5">
          {flag ? <img src={flag} alt="" className="h-3 rounded-sm object-cover" style={{ width: "1.1rem" }} /> : null}
          <p className="truncate text-sm font-black text-green-950">{player.name}</p>
        </div>
        <span className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${rarityBadge[player.rarity] ?? rarityBadge.common}`}>{player.rarity}</span>
      </div>
    </div>
  );
}

// Inline compact chip: flag + name + rating, for dense lists.
function StickerChip({ player }: { player: Player | undefined }) {
  if (!player) return <span className="rounded bg-green-950/10 px-1.5 py-0.5 text-xs font-bold">Unknown</span>;
  const flag = flagUrl(player.nation);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ring-1 ${rarityBadge[player.rarity] ?? rarityBadge.common}`}>
      {flag ? <img src={flag} alt="" className="h-3 rounded-sm object-cover" style={{ width: "1rem" }} /> : null}
      {player.name} {player.rating}
    </span>
  );
}
