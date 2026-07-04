"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { PageTitle } from "@/components/PageTitle";
import { flagUrl } from "@/lib/flags";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import { loadUserStateAsync } from "@/lib/storage";
import type { Player, UserState } from "@/lib/types";

type TradeProposal = { id: number; username: string; playerId: number; isMine: boolean };
type TradeOffer = {
  id: number;
  username: string;
  playerId: number;
  createdAt: string;
  isMine: boolean;
  spareCount: number;
  offererOwnedPlayerIds: number[];
  offererDuplicateCounts: Record<number, number>;
  proposals: TradeProposal[];
};
type RecentTrade = { offererUsername: string; acceptorUsername: string; playerId: number; acceptedPlayerId: number; completedAt: string };
type TradeView = "home" | "offer" | "recommended" | "teams" | "desk" | "market";
type NationProgress = { nation: string; total: number; owned: number; missing: Player[]; percent: number };

const COLLECTION_BOOST = 3;

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
  const [activeView, setActiveView] = useState<TradeView>("home");
  const [search, setSearch] = useState("");

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
  const ownedIds = useMemo(() => new Set(state?.ownedPlayerIds ?? []), [state]);

  const collectionPlayers = useMemo(() => playerPool.filter((player) => !player.cupId), [playerPool]);

  const nationProgress = useMemo<NationProgress[]>(() => {
    const byNation = new Map<string, Player[]>();
    for (const player of collectionPlayers) {
      const list = byNation.get(player.nation) ?? [];
      list.push(player);
      byNation.set(player.nation, list);
    }

    return [...byNation.entries()]
      .map(([nation, players]) => {
        const missing = players.filter((player) => !ownedIds.has(player.id)).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
        const owned = players.length - missing.length;
        return { nation, total: players.length, owned, missing, percent: Math.round((owned / players.length) * 100) };
      })
      .sort((a, b) => a.missing.length - b.missing.length || b.percent - a.percent || a.nation.localeCompare(b.nation));
  }, [collectionPlayers, ownedIds]);

  const progressByNation = useMemo(() => new Map(nationProgress.map((progress) => [progress.nation, progress])), [nationProgress]);

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

  const recommendedOffers = useMemo(() => {
    return otherOffers
      .filter((offer) => !ownedIds.has(offer.playerId))
      .sort((a, b) => {
        const aPlayer = playerById.get(a.playerId);
        const bPlayer = playerById.get(b.playerId);
        const aProgress = aPlayer ? progressByNation.get(aPlayer.nation) : undefined;
        const bProgress = bPlayer ? progressByNation.get(bPlayer.nation) : undefined;
        return (
          Number(bProgress?.missing.length === 1) - Number(aProgress?.missing.length === 1) ||
          (aProgress?.missing.length ?? 999) - (bProgress?.missing.length ?? 999) ||
          (bPlayer?.rating ?? 0) - (aPlayer?.rating ?? 0)
        );
      });
  }, [otherOffers, ownedIds, playerById, progressByNation]);

  const visibleAllOffers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return otherOffers;
    return otherOffers.filter((offer) => {
      const player = playerById.get(offer.playerId);
      return [offer.username, player?.name, player?.nation, player?.rarity].some((value) => value?.toLowerCase().includes(query));
    });
  }, [otherOffers, playerById, search]);

  const missingTargets = nationProgress.filter((progress) => progress.missing.length > 0).slice(0, 6);
  const completedNations = nationProgress.filter((progress) => progress.missing.length === 0).length;
  const needsCount = collectionPlayers.filter((player) => !ownedIds.has(player.id)).length;

  return (
    <div>
      <PageTitle title="Trading Hub" subtitle="Swap duplicates and finish teams for collection boosts." />

      {tradeNotice ? <p className="mb-4 rounded-md bg-amber-100 px-3 py-2 text-sm font-black text-amber-900">{tradeNotice}</p> : null}

      {activeView === "home" ? (
        <>
          <section className="mb-5 overflow-hidden rounded-2xl border border-green-900/10 bg-gradient-to-br from-green-950 via-green-900 to-amber-700 p-5 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/65">What do you want to do?</p>
            <h2 className="mt-2 max-w-2xl text-2xl font-black sm:text-3xl">Make one smart swap, finish a team, or manage your offers.</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-white/75">
              Team collections give every player from that nation +{COLLECTION_BOOST}. Start with recommended swaps if you want the shortest route.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <MiniStat label="Useful offers" value={recommendedOffers.length} />
              <MiniStat label="Your spares" value={myDuplicates.length} />
              <MiniStat label="Open offers" value={otherOffers.length} />
              <MiniStat label="Teams done" value={completedNations} />
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <ActionCard
              title="Best trades for me"
              text="See only offers for stickers you still need."
              meta={`${recommendedOffers.length} useful offers`}
              tone="green"
              onClick={() => setActiveView("recommended")}
            />
            <ActionCard
              title="Post a duplicate"
              text="Put one spare sticker up for a one-for-one swap."
              meta={`${myDuplicates.length} spare players`}
              tone="amber"
              onClick={() => setActiveView("offer")}
            />
            <ActionCard
              title="Finish a team"
              text={`Find the closest nations to unlock the +${COLLECTION_BOOST} boost.`}
              meta={`${needsCount} stickers still needed`}
              tone="white"
              onClick={() => setActiveView("teams")}
            />
            <ActionCard
              title="My offers"
              text="Accept, decline, or cancel your active trade offers."
              meta={`${myOffers.length} active offers`}
              tone="white"
              onClick={() => setActiveView("desk")}
            />
          </div>

          <button
            type="button"
            onClick={() => setActiveView("market")}
            className="mt-4 w-full rounded-xl border border-green-900/10 bg-white px-4 py-3 text-left text-sm font-black text-green-950 shadow-sm transition hover:bg-green-50"
          >
            Browse the full market <span className="font-semibold text-green-900/50">({otherOffers.length} open offers)</span>
          </button>

          {recentTrades.length > 0 ? (
            <section className="mt-5 rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
              <SectionHeader title="Latest Swaps" text="A quick look at recent completed trades." />
              <div className="mt-3 space-y-2">
                {recentTrades.slice(0, 3).map((trade, index) => (
                  <RecentTradeRow key={index} trade={trade} playerById={playerById} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {activeView !== "home" ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveView("home")}>
            Back to trading home
          </Button>
          <button type="button" onClick={() => setActiveView("market")} className="text-xs font-black uppercase tracking-wide text-green-900/55 underline">
            Full market
          </button>
        </div>
      ) : null}

      {activeView === "offer" ? (
        <section className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-green-50 p-4 shadow-sm">
          <SectionHeader title="Post A Duplicate" text="Choose one spare copy. Your original card stays in your club unless a confirmed trade uses the duplicate." />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-950"
              value={offerPlayerId}
              onChange={(event) => setOfferPlayerId(event.target.value ? Number(event.target.value) : "")}
            >
              <option value="">{myDuplicates.length > 0 ? "Choose a duplicate to offer..." : "No duplicates to offer"}</option>
              {myDuplicates.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} - {player.rating} {player.rarity} - {player.nation} - spare x{state?.duplicateCounts[player.id] ?? 0}
                </option>
              ))}
            </select>
            {offerPreview ? <StickerChip player={offerPreview} suffix={`spare x${state?.duplicateCounts[offerPreview.id] ?? 0}`} /> : null}
            <Button
              variant="accent"
              className="shrink-0"
              onClick={() => offerPlayerId !== "" && tradeAction({ action: "create", playerId: offerPlayerId }, "Offer posted. Waiting for proposals.")}
              disabled={tradeBusy || offerPlayerId === ""}
            >
              Post Offer
            </Button>
          </div>
          {myDuplicates.length === 0 ? (
            <p className="mt-3 text-xs font-semibold text-amber-700/80">
              No duplicates yet. Pull more stickers from{" "}
              <Link href="/add-km" className="underline">
                logging activity
              </Link>{" "}
              or opening packs.
            </p>
          ) : null}
        </section>
      ) : null}

      {activeView === "recommended" ? (
        <section className="rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
          <SectionHeader title="Recommended Trades" text="These offers contain stickers you do not own, with team-completion swaps pushed to the top." />
          <OfferList
            offers={recommendedOffers}
            playerById={playerById}
            ownedIds={ownedIds}
            duplicateCounts={state?.duplicateCounts ?? {}}
            myDuplicates={myDuplicates}
            acceptSelections={acceptSelections}
            setAcceptSelections={setAcceptSelections}
            progressByNation={progressByNation}
            tradeBusy={tradeBusy}
            tradeAction={tradeAction}
            emptyText="No open offers currently help your collection. Post a strong duplicate and make the market come to you."
          />
        </section>
      ) : null}

      {activeView === "teams" ? (
        <section className="rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
          <SectionHeader title="Missing Team Targets" text={`Complete any team to add +${COLLECTION_BOOST} to all of its players. Available trades are shown beside the missing stickers.`} />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {missingTargets.map((progress) => (
              <NationTargetCard
                key={progress.nation}
                progress={progress}
                offers={otherOffers}
                playerById={playerById}
                ownedIds={ownedIds}
                duplicateCounts={state?.duplicateCounts ?? {}}
                myDuplicates={myDuplicates}
                acceptSelections={acceptSelections}
                setAcceptSelections={setAcceptSelections}
                progressByNation={progressByNation}
                tradeBusy={tradeBusy}
                tradeAction={tradeAction}
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeView === "desk" ? (
        <section className="rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
          <SectionHeader title="Your Trade Desk" text="Manage your posted duplicates and decide which incoming proposal is worth taking." />
          <div className="mt-3 space-y-3">
            {myOffers.length > 0 ? (
              myOffers.map((offer) => (
                <YourOfferCard
                  key={offer.id}
                  offer={offer}
                  playerById={playerById}
                  duplicateCounts={state?.duplicateCounts ?? {}}
                  tradeBusy={tradeBusy}
                  tradeAction={tradeAction}
                />
              ))
            ) : (
              <p className="text-sm font-semibold text-green-900/55">You have no open offers. Post one above and make the market move.</p>
            )}
          </div>
        </section>
      ) : null}

      {activeView === "market" ? (
        <section className="rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader title="All Open Offers" text="Search the whole trade market when you know exactly who you want." />
            <input
              className="rounded-md border border-green-900/15 bg-white px-3 py-2 text-sm font-bold text-green-950 placeholder:text-green-900/35"
              placeholder="Search player, nation, rarity, user..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <OfferList
            offers={visibleAllOffers}
            playerById={playerById}
            ownedIds={ownedIds}
            duplicateCounts={state?.duplicateCounts ?? {}}
            myDuplicates={myDuplicates}
            acceptSelections={acceptSelections}
            setAcceptSelections={setAcceptSelections}
            progressByNation={progressByNation}
            tradeBusy={tradeBusy}
            tradeAction={tradeAction}
            emptyText="No matching open offers right now."
          />
        </section>
      ) : null}
    </div>
  );
}

function OfferList({
  offers,
  playerById,
  ownedIds,
  duplicateCounts,
  myDuplicates,
  acceptSelections,
  setAcceptSelections,
  progressByNation,
  tradeBusy,
  tradeAction,
  emptyText
}: {
  offers: TradeOffer[];
  playerById: Map<number, Player>;
  ownedIds: Set<number>;
  duplicateCounts: Record<number, number>;
  myDuplicates: Player[];
  acceptSelections: Record<number, number>;
  setAcceptSelections: (updater: (prev: Record<number, number>) => Record<number, number>) => void;
  progressByNation: Map<string, NationProgress>;
  tradeBusy: boolean;
  tradeAction: (body: Record<string, unknown>, successNotice: string) => Promise<void>;
  emptyText: string;
}) {
  if (offers.length === 0) return <p className="mt-3 text-sm font-semibold text-green-900/55">{emptyText}</p>;

  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-2">
      {offers.map((offer) => (
        <OpenOfferCard
          key={offer.id}
          offer={offer}
          playerById={playerById}
          ownedIds={ownedIds}
          duplicateCounts={duplicateCounts}
          myDuplicates={myDuplicates}
          acceptSelections={acceptSelections}
          setAcceptSelections={setAcceptSelections}
          progressByNation={progressByNation}
          tradeBusy={tradeBusy}
          tradeAction={tradeAction}
        />
      ))}
    </div>
  );
}

function OpenOfferCard({
  offer,
  playerById,
  ownedIds,
  duplicateCounts,
  myDuplicates,
  acceptSelections,
  setAcceptSelections,
  progressByNation,
  tradeBusy,
  tradeAction
}: {
  offer: TradeOffer;
  playerById: Map<number, Player>;
  ownedIds: Set<number>;
  duplicateCounts: Record<number, number>;
  myDuplicates: Player[];
  acceptSelections: Record<number, number>;
  setAcceptSelections: (updater: (prev: Record<number, number>) => Record<number, number>) => void;
  progressByNation: Map<string, NationProgress>;
  tradeBusy: boolean;
  tradeAction: (body: Record<string, unknown>, successNotice: string) => Promise<void>;
}) {
  const player = playerById.get(offer.playerId);
  const progress = player ? progressByNation.get(player.nation) : undefined;
  const myProposal = offer.proposals.find((proposal) => proposal.isMine);
  const selectedPlayerId = acceptSelections[offer.id];
  const sortedDuplicates = [...myDuplicates].sort((a, b) => {
    const aNeeded = !offer.offererOwnedPlayerIds.includes(a.id);
    const bNeeded = !offer.offererOwnedPlayerIds.includes(b.id);
    return Number(bNeeded) - Number(aNeeded) || b.rating - a.rating || a.name.localeCompare(b.name);
  });

  return (
    <div className="rounded-xl border border-green-900/10 bg-green-950/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StickerCard player={player} fallbackId={offer.playerId} label={`${offer.username} offers`} />
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge tone={ownedIds.has(offer.playerId) ? "muted" : "good"}>{ownedIds.has(offer.playerId) ? "Already owned" : "You need this"}</Badge>
          {progress?.missing.length === 1 ? <Badge tone="gold">Completes {player?.nation}</Badge> : null}
          <Badge tone={offer.spareCount > 0 ? "muted" : "danger"}>{offer.spareCount > 0 ? `Spare x${offer.spareCount}` : "No spare now"}</Badge>
        </div>
      </div>
      {progress && progress.missing.length > 1 ? (
        <p className="mt-2 text-xs font-bold text-green-900/60">
          {player?.nation}: {progress.owned}/{progress.total} collected. This leaves {Math.max(progress.missing.length - 1, 0)} missing.
        </p>
      ) : null}
      {myProposal ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-green-900/10 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-green-900/60">You proposed</span>
            <StickerChip player={playerById.get(myProposal.playerId)} suffix={`spare x${duplicateCounts[myProposal.playerId] ?? 0}`} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => tradeAction({ action: "withdraw", proposalId: myProposal.id }, "Proposal withdrawn.")} disabled={tradeBusy}>
            Withdraw
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-green-900/10 pt-3">
          <span className="text-xs font-black uppercase tracking-wide text-green-900/50">Give</span>
          <select
            className="min-w-0 flex-1 rounded-md border border-green-900/20 bg-white px-2 py-1.5 text-xs font-bold text-green-950"
            value={selectedPlayerId ?? ""}
            onChange={(event) => setAcceptSelections((prev) => ({ ...prev, [offer.id]: Number(event.target.value) }))}
          >
            <option value="">Choose one of your duplicates...</option>
            {sortedDuplicates.map((duplicate) => (
              <option key={duplicate.id} value={duplicate.id}>
                {duplicate.name} - spare x{duplicateCounts[duplicate.id] ?? 0} - {offer.offererOwnedPlayerIds.includes(duplicate.id) ? "they own it" : "they need it"}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={() => selectedPlayerId && tradeAction({ action: "propose", offerId: offer.id, playerId: selectedPlayerId }, "Proposal sent. The offerer decides.")}
            disabled={tradeBusy || !selectedPlayerId || offer.spareCount < 1}
          >
            Propose
          </Button>
        </div>
      )}
    </div>
  );
}

function YourOfferCard({
  offer,
  playerById,
  duplicateCounts,
  tradeBusy,
  tradeAction
}: {
  offer: TradeOffer;
  playerById: Map<number, Player>;
  duplicateCounts: Record<number, number>;
  tradeBusy: boolean;
  tradeAction: (body: Record<string, unknown>, successNotice: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StickerCard player={playerById.get(offer.playerId)} fallbackId={offer.playerId} label="You're offering" />
        <div className="flex items-center gap-2">
          <Badge tone={(duplicateCounts[offer.playerId] ?? 0) > 0 ? "muted" : "danger"}>Your spare x{duplicateCounts[offer.playerId] ?? 0}</Badge>
          <Button variant="ghost" size="sm" onClick={() => tradeAction({ action: "cancel", offerId: offer.id }, "Offer withdrawn.")} disabled={tradeBusy}>
            Cancel
          </Button>
        </div>
      </div>
      {offer.proposals.length > 0 ? (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-amber-800/80">{offer.proposals.length} proposal{offer.proposals.length === 1 ? "" : "s"} - pick one</p>
          {offer.proposals.map((proposal) => (
            <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/75 px-2 py-2">
              <StickerCard player={playerById.get(proposal.playerId)} fallbackId={proposal.playerId} label={`${proposal.username} gives`} />
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => tradeAction({ action: "confirm", proposalId: proposal.id }, "Trade complete.")} disabled={tradeBusy}>
                  Confirm
                </Button>
                <Button variant="ghost" size="sm" onClick={() => tradeAction({ action: "decline", proposalId: proposal.id }, "Proposal declined.")} disabled={tradeBusy}>
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-amber-700/75">No proposals yet. Stronger duplicates usually get first bites.</p>
      )}
    </div>
  );
}

function NationTargetCard({
  progress,
  offers,
  playerById,
  ownedIds,
  duplicateCounts,
  myDuplicates,
  acceptSelections,
  setAcceptSelections,
  progressByNation,
  tradeBusy,
  tradeAction
}: {
  progress: NationProgress;
  offers: TradeOffer[];
  playerById: Map<number, Player>;
  ownedIds: Set<number>;
  duplicateCounts: Record<number, number>;
  myDuplicates: Player[];
  acceptSelections: Record<number, number>;
  setAcceptSelections: (updater: (prev: Record<number, number>) => Record<number, number>) => void;
  progressByNation: Map<string, NationProgress>;
  tradeBusy: boolean;
  tradeAction: (body: Record<string, unknown>, successNotice: string) => Promise<void>;
}) {
  const flag = flagUrl(progress.nation);

  return (
    <div className="rounded-xl border border-green-900/10 bg-green-950/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {flag ? <img src={flag} alt="" className="h-5 rounded-sm object-cover" style={{ width: "1.8rem" }} /> : null}
          <div>
            <p className="text-sm font-black text-green-950">{progress.nation}</p>
            <p className="text-xs font-bold text-green-900/55">{progress.owned}/{progress.total} collected</p>
          </div>
        </div>
        <Badge tone={progress.missing.length === 1 ? "gold" : "muted"}>{progress.missing.length} missing</Badge>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-green-950/10">
        <div className="h-full rounded-full bg-pitch" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="mt-3 space-y-2">
        {progress.missing.slice(0, 5).map((missingPlayer) => {
          const matchingOffers = offers.filter((offer) => offer.playerId === missingPlayer.id);
          return (
            <div key={missingPlayer.id} className="rounded-lg bg-white/75 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StickerChip player={missingPlayer} />
                {matchingOffers.length > 0 ? <Badge tone="good">{matchingOffers.length} open</Badge> : <Badge tone="muted">No open spare</Badge>}
              </div>
              {matchingOffers.slice(0, 2).map((offer) => (
                <div key={offer.id} className="mt-2">
                  <OpenOfferCard
                    offer={offer}
                    playerById={playerById}
                    ownedIds={ownedIds}
                    duplicateCounts={duplicateCounts}
                    myDuplicates={myDuplicates}
                    acceptSelections={acceptSelections}
                    setAcceptSelections={setAcceptSelections}
                    progressByNation={progressByNation}
                    tradeBusy={tradeBusy}
                    tradeAction={tradeAction}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionCard({
  title,
  text,
  meta,
  tone,
  onClick
}: {
  title: string;
  text: string;
  meta: string;
  tone: "green" | "amber" | "white";
  onClick: () => void;
}) {
  const classes = {
    green: "border-green-800 bg-green-950 text-white hover:bg-green-900",
    amber: "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100",
    white: "border-green-900/10 bg-white text-green-950 hover:bg-green-50"
  };

  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border p-5 text-left shadow-sm transition ${classes[tone]}`}>
      <p className="text-lg font-black">{title}</p>
      <p className={`mt-1 text-sm font-semibold ${tone === "green" ? "text-white/75" : "text-green-900/60"}`}>{text}</p>
      <p className={`mt-4 text-xs font-black uppercase tracking-wide ${tone === "green" ? "text-white/55" : "text-green-900/45"}`}>{meta}</p>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
      <p className="text-xl font-black">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wide text-white/60">{label}</p>
    </div>
  );
}

function SectionHeader({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-wide text-green-900/60">{title}</p>
      <p className="mt-1 text-xs font-semibold text-green-900/55">{text}</p>
    </div>
  );
}

function RecentTradeRow({ trade, playerById }: { trade: RecentTrade; playerById: Map<number, Player> }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-green-950/5 px-3 py-2 text-xs font-bold text-green-950">
      <span className="font-black">{trade.offererUsername}</span>
      <StickerChip player={playerById.get(trade.playerId)} />
      <span className="text-green-900/45">swapped for</span>
      <StickerChip player={playerById.get(trade.acceptedPlayerId)} />
      <span className="font-black">{trade.acceptorUsername}</span>
    </div>
  );
}

function Badge({ tone, children }: { tone: "good" | "gold" | "muted" | "danger"; children: ReactNode }) {
  const classes = {
    good: "bg-emerald-100 text-emerald-900 ring-emerald-200",
    gold: "bg-amber-100 text-amber-900 ring-amber-200",
    muted: "bg-green-950/10 text-green-950 ring-green-900/10",
    danger: "bg-red-100 text-red-900 ring-red-200"
  };
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${classes[tone]}`}>{children}</span>;
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

function StickerChip({ player, suffix }: { player: Player | undefined; suffix?: string }) {
  if (!player) return <span className="rounded bg-green-950/10 px-1.5 py-0.5 text-xs font-bold">Unknown</span>;
  const flag = flagUrl(player.nation);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ring-1 ${rarityBadge[player.rarity] ?? rarityBadge.common}`}>
      {flag ? <img src={flag} alt="" className="h-3 rounded-sm object-cover" style={{ width: "1rem" }} /> : null}
      {player.name} {player.rating}
      {suffix ? <span className="opacity-75">({suffix})</span> : null}
    </span>
  );
}
