"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { PageTitle } from "@/components/PageTitle";
import { flagUrl } from "@/lib/flags";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import { loadUserStateAsync } from "@/lib/storage";
import type { Player, UserState } from "@/lib/types";

type MarketEntry = { userId: number; username: string; playerId: number; duplicateCount: number };
type DirectProposal = {
  id: number;
  proposerId: number;
  proposerUsername: string;
  targetUserId: number;
  targetUsername: string;
  wantedPlayerId: number;
  offeredPlayerId: number;
  createdAt: string;
  expiresAt: string;
  isMine: boolean;
  isIncoming: boolean;
};
type RecentTrade = { offererUsername: string; acceptorUsername: string; playerId: number; acceptedPlayerId: number; completedAt: string };
type TradeView = "home" | "recommended" | "proposals" | "teams" | "market";
type BestSwapMode = "collections" | "ranking";
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
  const [market, setMarket] = useState<MarketEntry[]>([]);
  const [proposals, setProposals] = useState<DirectProposal[]>([]);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [offerSelections, setOfferSelections] = useState<Record<string, number>>({});
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeNotice, setTradeNotice] = useState("");
  const [activeView, setActiveView] = useState<TradeView>("home");
  const [bestSwapMode, setBestSwapMode] = useState<BestSwapMode>("collections");
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
      setMarket(payload.market ?? []);
      setProposals(payload.proposals ?? []);
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

  const myDuplicates = useMemo(
    () =>
      Object.entries(state?.duplicateCounts ?? {})
        .filter(([, count]) => (count ?? 0) > 0)
        .map(([id]) => playerById.get(Number(id)))
        .filter((player): player is Player => Boolean(player))
        .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)),
    [state, playerById]
  );

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
  const missingTargets = nationProgress.filter((progress) => progress.missing.length > 0).slice(0, 6);
  const completedNations = nationProgress.filter((progress) => progress.missing.length === 0).length;

  const recommendedMarket = useMemo(() => {
    return market
      .filter((entry) => !ownedIds.has(entry.playerId))
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
  }, [market, ownedIds, playerById, progressByNation]);

  const rankedMarket = useMemo(() => {
    return market
      .filter((entry) => !ownedIds.has(entry.playerId))
      .sort((a, b) => {
        const aPlayer = playerById.get(a.playerId);
        const bPlayer = playerById.get(b.playerId);
        return (bPlayer?.rating ?? 0) - (aPlayer?.rating ?? 0) || (b.duplicateCount ?? 0) - (a.duplicateCount ?? 0);
      });
  }, [market, ownedIds, playerById]);

  const activeBestSwaps = bestSwapMode === "collections" ? recommendedMarket : rankedMarket;
  const visibleMarket = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return market;
    return market.filter((entry) => {
      const player = playerById.get(entry.playerId);
      return [entry.username, player?.name, player?.nation, player?.rarity].some((value) => value?.toLowerCase().includes(query));
    });
  }, [market, playerById, search]);

  const incoming = proposals.filter((proposal) => proposal.isIncoming);
  const outgoing = proposals.filter((proposal) => proposal.isMine);

  return (
    <div>
      <PageTitle title="Trading Hub" subtitle="Every duplicate is automatically available. Send a one-for-one proposal that expires after 24 hours." />

      {tradeNotice ? <p className="mb-4 rounded-md bg-amber-100 px-3 py-2 text-sm font-black text-amber-900">{tradeNotice}</p> : null}

      {activeView === "home" ? (
        <>
          <section className="mb-5 overflow-hidden rounded-2xl border border-green-900/10 bg-gradient-to-br from-green-950 via-green-900 to-amber-700 p-5 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/65">Trading is automatic now</p>
            <h2 className="mt-2 max-w-2xl text-2xl font-black sm:text-3xl">Pick a card you want, choose the duplicate you give back.</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-white/75">
              No listing needed. Proposed swaps are active for one day, then auto-rejected.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <MiniStat label="Useful cards" value={recommendedMarket.length} />
              <MiniStat label="My duplicates" value={myDuplicates.length} />
              <MiniStat label="Incoming" value={incoming.length} />
              <MiniStat label="Teams done" value={completedNations} />
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <ActionCard title="Best swaps for me" text="Cards on the market that you do not own yet." meta={`${recommendedMarket.length} useful cards`} tone="green" onClick={() => setActiveView("recommended")} />
            <ActionCard title="Proposals" text="Accept incoming swaps or withdraw your outgoing ones." meta={`${incoming.length} incoming, ${outgoing.length} sent`} tone="amber" onClick={() => setActiveView("proposals")} />
            <ActionCard title="Finish a team" text={`Target the closest nations for the +${COLLECTION_BOOST} boost.`} meta={`${missingTargets.length} close teams`} tone="white" onClick={() => setActiveView("teams")} />
            <ActionCard title="Full market" text="Search every duplicate currently available." meta={`${market.length} duplicate cards`} tone="white" onClick={() => setActiveView("market")} />
          </div>

          {recentTrades.length > 0 ? (
            <section className="mt-5 rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
              <SectionHeader title="Latest Swaps" text="Recently completed one-for-one trades." />
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

      {activeView === "recommended" ? (
        <section className="rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeader
              title="Best Swaps For Me"
              text={bestSwapMode === "collections" ? "Cards that get you closest to completing teams and unlocking boosts." : "Highest-rated available cards you do not own yet."}
            />
            <div className="inline-flex rounded-full bg-green-950/10 p-1">
              <ModeButton active={bestSwapMode === "collections"} onClick={() => setBestSwapMode("collections")}>
                Complete teams
              </ModeButton>
              <ModeButton active={bestSwapMode === "ranking"} onClick={() => setBestSwapMode("ranking")}>
                Top ranked
              </ModeButton>
            </div>
          </div>
          <BestSwapShowcase entries={activeBestSwaps.slice(0, 3)} playerById={playerById} progressByNation={progressByNation} mode={bestSwapMode} />
          <MarketList
            entries={activeBestSwaps}
            playerById={playerById}
            ownedIds={ownedIds}
            duplicateCounts={state?.duplicateCounts ?? {}}
            myDuplicates={myDuplicates}
            offerSelections={offerSelections}
            setOfferSelections={setOfferSelections}
            progressByNation={progressByNation}
            tradeBusy={tradeBusy}
            tradeAction={tradeAction}
            emptyText="No available duplicate currently improves your collection."
          />
        </section>
      ) : null}

      {activeView === "proposals" ? (
        <section className="rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
          <SectionHeader title="Proposed Trades" text="Incoming proposals can be accepted or rejected. Your sent proposals can be withdrawn." />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ProposalColumn title={`Incoming (${incoming.length})`} emptyText="No one has proposed a swap to you yet.">
              {incoming.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} playerById={playerById} tradeBusy={tradeBusy} tradeAction={tradeAction} />
              ))}
            </ProposalColumn>
            <ProposalColumn title={`Sent (${outgoing.length})`} emptyText="You have not sent any active proposals.">
              {outgoing.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} playerById={playerById} tradeBusy={tradeBusy} tradeAction={tradeAction} />
              ))}
            </ProposalColumn>
          </div>
        </section>
      ) : null}

      {activeView === "teams" ? (
        <section className="rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
          <SectionHeader title="Finish A Team" text={`Complete any nation to add +${COLLECTION_BOOST} to all of its players.`} />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {missingTargets.map((progress) => (
              <NationTargetCard
                key={progress.nation}
                progress={progress}
                market={market}
                playerById={playerById}
                ownedIds={ownedIds}
                duplicateCounts={state?.duplicateCounts ?? {}}
                myDuplicates={myDuplicates}
                offerSelections={offerSelections}
                setOfferSelections={setOfferSelections}
                progressByNation={progressByNation}
                tradeBusy={tradeBusy}
                tradeAction={tradeAction}
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeView === "market" ? (
        <section className="rounded-2xl border border-green-900/10 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader title="Full Duplicate Market" text="Every spare card is automatically available here." />
            <input
              className="rounded-md border border-green-900/15 bg-white px-3 py-2 text-sm font-bold text-green-950 placeholder:text-green-900/35"
              placeholder="Search player, nation, rarity, user..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <MarketList
            entries={visibleMarket}
            playerById={playerById}
            ownedIds={ownedIds}
            duplicateCounts={state?.duplicateCounts ?? {}}
            myDuplicates={myDuplicates}
            offerSelections={offerSelections}
            setOfferSelections={setOfferSelections}
            progressByNation={progressByNation}
            tradeBusy={tradeBusy}
            tradeAction={tradeAction}
            emptyText="No matching duplicates are available right now."
          />
        </section>
      ) : null}
    </div>
  );
}

function MarketList({
  entries,
  playerById,
  ownedIds,
  duplicateCounts,
  myDuplicates,
  offerSelections,
  setOfferSelections,
  progressByNation,
  tradeBusy,
  tradeAction,
  emptyText
}: {
  entries: MarketEntry[];
  playerById: Map<number, Player>;
  ownedIds: Set<number>;
  duplicateCounts: Record<number, number>;
  myDuplicates: Player[];
  offerSelections: Record<string, number>;
  setOfferSelections: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  progressByNation: Map<string, NationProgress>;
  tradeBusy: boolean;
  tradeAction: (body: Record<string, unknown>, successNotice: string) => Promise<void>;
  emptyText: string;
}) {
  if (entries.length === 0) return <p className="mt-3 text-sm font-semibold text-green-900/55">{emptyText}</p>;

  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-2">
      {entries.map((entry) => (
        <MarketCard
          key={`${entry.userId}:${entry.playerId}`}
          entry={entry}
          playerById={playerById}
          ownedIds={ownedIds}
          duplicateCounts={duplicateCounts}
          myDuplicates={myDuplicates}
          offerSelections={offerSelections}
          setOfferSelections={setOfferSelections}
          progressByNation={progressByNation}
          tradeBusy={tradeBusy}
          tradeAction={tradeAction}
        />
      ))}
    </div>
  );
}

function BestSwapShowcase({
  entries,
  playerById,
  progressByNation,
  mode
}: {
  entries: MarketEntry[];
  playerById: Map<number, Player>;
  progressByNation: Map<string, NationProgress>;
  mode: BestSwapMode;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {entries.map((entry, index) => {
        const player = playerById.get(entry.playerId);
        const progress = player ? progressByNation.get(player.nation) : undefined;
        const helper =
          mode === "collections"
            ? progress?.missing.length === 1
              ? `Completes ${player?.nation}`
              : `${player?.nation ?? "Team"}: ${progress?.owned ?? 0}/${progress?.total ?? 0}`
            : `${player?.rating ?? "-"} rated ${player?.rarity ?? "card"}`;

        return (
          <div key={`${entry.userId}:${entry.playerId}:showcase`} className="overflow-hidden rounded-2xl border border-green-900/10 bg-gradient-to-br from-green-950 to-green-800 p-4 text-white shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">#{index + 1} target</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ring-2 ${rarityRing[player?.rarity ?? "common"] ?? rarityRing.common}`}>
                <span className="text-lg font-black leading-none text-green-950">{player?.rating ?? "-"}</span>
                <span className="text-[8px] font-black uppercase leading-none text-green-950/70">{player?.pos ?? ""}</span>
              </div>
              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-sm font-black">{player?.name ?? `Player ${entry.playerId}`}</p>
                <p className="mt-1 text-xs font-bold text-white/65">{helper}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-200">{entry.username} has spare x{entry.duplicateCount}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarketCard({
  entry,
  playerById,
  ownedIds,
  duplicateCounts,
  myDuplicates,
  offerSelections,
  setOfferSelections,
  progressByNation,
  tradeBusy,
  tradeAction
}: {
  entry: MarketEntry;
  playerById: Map<number, Player>;
  ownedIds: Set<number>;
  duplicateCounts: Record<number, number>;
  myDuplicates: Player[];
  offerSelections: Record<string, number>;
  setOfferSelections: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  progressByNation: Map<string, NationProgress>;
  tradeBusy: boolean;
  tradeAction: (body: Record<string, unknown>, successNotice: string) => Promise<void>;
}) {
  const player = playerById.get(entry.playerId);
  const progress = player ? progressByNation.get(player.nation) : undefined;
  const key = `${entry.userId}:${entry.playerId}`;
  const selectedPlayerId = offerSelections[key];
  const matchingDuplicates = myDuplicates.filter((duplicate) => duplicate.id !== entry.playerId && duplicate.rarity === player?.rarity);
  const blockedByStatus = Boolean(player) && matchingDuplicates.length === 0;

  return (
    <div className="rounded-xl border border-green-900/10 bg-green-950/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StickerCard player={player} fallbackId={entry.playerId} label={`${entry.username} has spare`} />
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge tone={ownedIds.has(entry.playerId) ? "muted" : "good"}>{ownedIds.has(entry.playerId) ? "Already owned" : "You need this"}</Badge>
          {progress?.missing.length === 1 ? <Badge tone="gold">Completes {player?.nation}</Badge> : null}
          {player ? <Badge tone="muted">{player.rarity} only</Badge> : null}
          <Badge tone="muted">Spare x{entry.duplicateCount}</Badge>
        </div>
      </div>
      {blockedByStatus ? (
        <p className="mt-3 rounded-md bg-amber-100 px-2 py-1.5 text-xs font-bold text-amber-900">
          You need a spare {player?.rarity} card to propose for this one.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-green-900/10 pt-3">
        <span className="text-xs font-black uppercase tracking-wide text-green-900/50">Offer</span>
        <select
          className="min-w-0 flex-1 rounded-md border border-green-900/20 bg-white px-2 py-1.5 text-xs font-bold text-green-950"
          value={selectedPlayerId ?? ""}
          onChange={(event) => setOfferSelections((prev) => ({ ...prev, [key]: Number(event.target.value) }))}
        >
          <option value="">{matchingDuplicates.length > 0 ? `Choose your ${player?.rarity} duplicate...` : `No spare ${player?.rarity ?? "matching"} card`}</option>
          {matchingDuplicates.map((duplicate) => (
            <option key={duplicate.id} value={duplicate.id}>
              {duplicate.name} - spare x{duplicateCounts[duplicate.id] ?? 0} - {duplicate.nation}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          size="sm"
          className="shrink-0"
          onClick={() =>
            selectedPlayerId &&
            tradeAction(
              { action: "propose", targetUserId: entry.userId, wantedPlayerId: entry.playerId, offeredPlayerId: selectedPlayerId },
              "Trade proposed. It expires in 24 hours."
            )
          }
          disabled={tradeBusy || !selectedPlayerId || blockedByStatus}
        >
          Propose
        </Button>
      </div>
    </div>
  );
}

function ProposalColumn({ title, emptyText, children }: { title: string; emptyText: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-green-900/45">{title}</p>
      <div className="mt-2 space-y-3">{hasChildren ? children : <p className="text-sm font-semibold text-green-900/55">{emptyText}</p>}</div>
    </div>
  );
}

function ProposalCard({
  proposal,
  playerById,
  tradeBusy,
  tradeAction
}: {
  proposal: DirectProposal;
  playerById: Map<number, Player>;
  tradeBusy: boolean;
  tradeAction: (body: Record<string, unknown>, successNotice: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black text-green-950">
          {proposal.proposerUsername} offers {proposal.targetUsername}
        </p>
        <Badge tone="gold">Expires {formatExpiry(proposal.expiresAt)}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StickerChip player={playerById.get(proposal.offeredPlayerId)} />
        <span className="text-xs font-black uppercase tracking-wide text-green-900/45">for</span>
        <StickerChip player={playerById.get(proposal.wantedPlayerId)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-amber-200 pt-3">
        {proposal.isIncoming ? (
          <>
            <Button variant="primary" size="sm" onClick={() => tradeAction({ action: "confirm", proposalId: proposal.id }, "Trade complete.")} disabled={tradeBusy}>
              Accept
            </Button>
            <Button variant="ghost" size="sm" onClick={() => tradeAction({ action: "decline", proposalId: proposal.id }, "Proposal rejected.")} disabled={tradeBusy}>
              Reject
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => tradeAction({ action: "withdraw", proposalId: proposal.id }, "Proposal withdrawn.")} disabled={tradeBusy}>
            Withdraw
          </Button>
        )}
      </div>
    </div>
  );
}

function NationTargetCard({
  progress,
  market,
  playerById,
  ownedIds,
  duplicateCounts,
  myDuplicates,
  offerSelections,
  setOfferSelections,
  progressByNation,
  tradeBusy,
  tradeAction
}: {
  progress: NationProgress;
  market: MarketEntry[];
  playerById: Map<number, Player>;
  ownedIds: Set<number>;
  duplicateCounts: Record<number, number>;
  myDuplicates: Player[];
  offerSelections: Record<string, number>;
  setOfferSelections: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
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
          const matchingEntries = market.filter((entry) => entry.playerId === missingPlayer.id);
          return (
            <div key={missingPlayer.id} className="rounded-lg bg-white/75 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StickerChip player={missingPlayer} />
                {matchingEntries.length > 0 ? <Badge tone="good">{matchingEntries.length} available</Badge> : <Badge tone="muted">No spare available</Badge>}
              </div>
              {matchingEntries.slice(0, 2).map((entry) => (
                <div key={`${entry.userId}:${entry.playerId}`} className="mt-2">
                  <MarketCard
                    entry={entry}
                    playerById={playerById}
                    ownedIds={ownedIds}
                    duplicateCounts={duplicateCounts}
                    myDuplicates={myDuplicates}
                    offerSelections={offerSelections}
                    setOfferSelections={setOfferSelections}
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

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-black transition ${active ? "bg-white text-green-950 shadow-sm" : "text-green-950/60 hover:text-green-950"}`}
    >
      {children}
    </button>
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

function StickerCard({ player, fallbackId, label }: { player: Player | undefined; fallbackId: number; label: string }) {
  if (!player) return <div className="text-sm font-bold text-green-900/60">{label}: Player {fallbackId}</div>;
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

function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
