"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { flagUrl } from "@/lib/flags";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import { loadUserStateAsync } from "@/lib/storage";
import type { Player, UserState } from "@/lib/types";

type MarketEntry = { userId: number; username: string; playerId: number; duplicateCount: number };
type RandomChallenge = {
  id: number;
  challengerId: number;
  challengerUsername: string;
  targetId: number;
  targetUsername: string;
  status: string;
  createdAt: string;
  isMine: boolean;
  isIncoming: boolean;
};
type RandomLogEntry = {
  id: number;
  challengerUsername: string;
  targetUsername: string;
  challengerPlayerId: number;
  targetPlayerId: number;
  completedAt: string;
};
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
type TradeView = "home" | "recommended" | "proposals" | "teams" | "market" | "danger";
type BestSwapMode = "collections" | "ranking";
type NationProgress = { nation: string; total: number; owned: number; missing: Player[]; percent: number };

const COLLECTION_BOOST = 3;

const RARITY_COLOUR: Record<string, string> = {
  icon: "text-zinc-300",
  legend: "text-amber-300",
  epic: "text-fuchsia-300",
  rare: "text-sky-300",
  common: "text-white/55",
  clowns: "text-red-300"
};

const RARITY_RING: Record<string, string> = {
  icon: "ring-zinc-400/60 bg-zinc-900/60",
  legend: "ring-amber-400/60 bg-amber-900/40",
  epic: "ring-fuchsia-400/60 bg-fuchsia-900/40",
  rare: "ring-sky-400/60 bg-sky-900/40",
  common: "ring-white/20 bg-white/8",
  clowns: "ring-red-400/60 bg-red-900/40"
};

const RARITY_ACCENT: Record<string, string> = {
  icon: "border-zinc-400/25 bg-zinc-400/8",
  legend: "border-amber-400/25 bg-amber-400/8",
  epic: "border-fuchsia-400/25 bg-fuchsia-400/8",
  rare: "border-sky-400/25 bg-sky-400/8",
  common: "border-white/15 bg-white/5",
  clowns: "border-red-400/25 bg-red-400/8"
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
  const [proposalTab, setProposalTab] = useState<"incoming" | "sent">("incoming");
  const [randomChallenges, setRandomChallenges] = useState<RandomChallenge[]>([]);
  const [randomLog, setRandomLog] = useState<RandomLogEntry[]>([]);
  const [otherUsers, setOtherUsers] = useState<{ id: number; username: string }[]>([]);
  const [dangerTargetId, setDangerTargetId] = useState(0);

  useEffect(() => {
    loadUserStateAsync().then(setState);
    loadPlayerPool().then(setPlayerPool);
    loadTrades();
    loadRandomSwaps();
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

  async function loadRandomSwaps() {
    try {
      const res = await fetch("/api/random-swap", { credentials: "include" });
      if (!res.ok) return;
      const payload = await res.json();
      setRandomChallenges(payload.challenges ?? []);
      setRandomLog(payload.log ?? []);
      setOtherUsers(payload.users ?? []);
    } catch {}
  }

  async function dangerAction(body: Record<string, unknown>, successNotice: string) {
    if (tradeBusy) return;
    setTradeBusy(true);
    setTradeNotice("");
    try {
      const res = await fetch("/api/random-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      const payload = await res.json();
      setTradeNotice(res.ok ? successNotice : payload.error ?? "Action failed.");
      await loadRandomSwaps();
    } finally {
      setTradeBusy(false);
    }
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

  const playerById = useMemo(() => new Map(playerPool.map((p) => [p.id, p])), [playerPool]);
  const ownedIds = useMemo(() => new Set(state?.ownedPlayerIds ?? []), [state]);
  const collectionPlayers = useMemo(() => playerPool.filter((p) => !p.cupId), [playerPool]);

  const myDuplicates = useMemo(
    () =>
      Object.entries(state?.duplicateCounts ?? {})
        .filter(([, count]) => (count ?? 0) > 0)
        .map(([id]) => playerById.get(Number(id)))
        .filter((p): p is Player => Boolean(p))
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
        const missing = players.filter((p) => !ownedIds.has(p.id)).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
        const owned = players.length - missing.length;
        return { nation, total: players.length, owned, missing, percent: Math.round((owned / players.length) * 100) };
      })
      .sort((a, b) => a.missing.length - b.missing.length || b.percent - a.percent || a.nation.localeCompare(b.nation));
  }, [collectionPlayers, ownedIds]);

  const progressByNation = useMemo(() => new Map(nationProgress.map((p) => [p.nation, p])), [nationProgress]);
  const missingTargets = nationProgress.filter((p) => p.missing.length > 0).slice(0, 6);
  const completedNations = nationProgress.filter((p) => p.missing.length === 0).length;

  const recommendedMarket = useMemo(() => {
    return market
      .filter((entry) => !ownedIds.has(entry.playerId))
      .sort((a, b) => {
        const aP = playerById.get(a.playerId);
        const bP = playerById.get(b.playerId);
        const aProg = aP ? progressByNation.get(aP.nation) : undefined;
        const bProg = bP ? progressByNation.get(bP.nation) : undefined;
        return (
          Number(bProg?.missing.length === 1) - Number(aProg?.missing.length === 1) ||
          (aProg?.missing.length ?? 999) - (bProg?.missing.length ?? 999) ||
          (bP?.rating ?? 0) - (aP?.rating ?? 0)
        );
      });
  }, [market, ownedIds, playerById, progressByNation]);

  const rankedMarket = useMemo(() => {
    return market
      .filter((entry) => !ownedIds.has(entry.playerId))
      .sort((a, b) => {
        const aP = playerById.get(a.playerId);
        const bP = playerById.get(b.playerId);
        return (bP?.rating ?? 0) - (aP?.rating ?? 0) || (b.duplicateCount ?? 0) - (a.duplicateCount ?? 0);
      });
  }, [market, ownedIds, playerById]);

  const activeBestSwaps = bestSwapMode === "collections" ? recommendedMarket : rankedMarket;
  const visibleMarket = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return market;
    return market.filter((entry) => {
      const player = playerById.get(entry.playerId);
      return [entry.username, player?.name, player?.nation, player?.rarity].some((v) => v?.toLowerCase().includes(query));
    });
  }, [market, playerById, search]);

  const incoming = proposals.filter((p) => p.isIncoming);
  const outgoing = proposals.filter((p) => p.isMine);
  const incomingChallenges = randomChallenges.filter((c) => c.isIncoming);

  const sharedProps = {
    playerById,
    ownedIds,
    duplicateCounts: state?.duplicateCounts ?? {},
    myDuplicates,
    offerSelections,
    setOfferSelections,
    progressByNation,
    tradeBusy,
    tradeAction
  };

  return (
    <div>
      <PageTitle title="Trading Hub" subtitle="Every duplicate is automatically available. Send a one-for-one proposal that expires after 24 hours." />

      {tradeNotice ? (
        <p className="mb-4 rounded-xl bg-amber-400/15 px-4 py-3 text-sm font-black text-amber-200 ring-1 ring-amber-400/25">{tradeNotice}</p>
      ) : null}

      {/* Persistent tab navigation */}
      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
        <TabButton active={activeView === "home"} onClick={() => setActiveView("home")}>
          Home
        </TabButton>
        <TabButton active={activeView === "recommended"} onClick={() => setActiveView("recommended")}>
          Best Swaps
          {recommendedMarket.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-black tabular-nums">{recommendedMarket.length}</span>
          ) : null}
        </TabButton>
        <TabButton active={activeView === "proposals"} onClick={() => setActiveView("proposals")}>
          Proposals
          {incoming.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-amber-400/30 px-1.5 py-0.5 text-[9px] font-black text-amber-200 tabular-nums">{incoming.length}</span>
          ) : null}
        </TabButton>
        <TabButton active={activeView === "teams"} onClick={() => setActiveView("teams")}>
          Finish Team
        </TabButton>
        <TabButton active={activeView === "market"} onClick={() => setActiveView("market")}>
          All Cards
        </TabButton>
        <TabButton active={activeView === "danger"} onClick={() => setActiveView("danger")} danger>
          🎲 Danger
          {incomingChallenges.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-red-500/40 px-1.5 py-0.5 text-[9px] font-black text-red-200 tabular-nums">{incomingChallenges.length}</span>
          ) : null}
        </TabButton>
      </nav>

      {/* ── HOME ─────────────────────────────────────────────── */}
      {activeView === "home" ? (
        <>
          <section className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-green-950 via-green-900 to-amber-800 p-5 text-white ring-1 ring-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Overview</p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">
              Pick a card you want.<br />Choose the duplicate you give back.
            </h2>
            <p className="mt-2 text-sm font-semibold text-white/65">No listing needed. Proposed swaps auto-expire after 24 hours.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <HeroStat label="Useful cards" value={recommendedMarket.length} />
              <HeroStat label="My duplicates" value={myDuplicates.length} />
              <HeroStat label="Incoming" value={incoming.length} accent={incoming.length > 0} />
              <HeroStat label="Teams done" value={completedNations} />
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <QuickCard
              icon="⚡"
              title="Best swaps for me"
              desc="Cards you don't own yet, ranked by how close they get you to a full nation."
              badge={`${recommendedMarket.length} useful`}
              accent="green"
              onClick={() => setActiveView("recommended")}
            />
            <QuickCard
              icon="🔔"
              title="Proposals"
              desc="Accept, reject, or withdraw one-for-one swap proposals."
              badge={incoming.length > 0 ? `${incoming.length} incoming` : "None pending"}
              accent={incoming.length > 0 ? "amber" : "neutral"}
              onClick={() => setActiveView("proposals")}
            />
            <QuickCard
              icon="🏳"
              title="Finish a team"
              desc={`Complete a nation for +${COLLECTION_BOOST} rating on all its players.`}
              badge={`${missingTargets.length} close teams`}
              accent="neutral"
              onClick={() => setActiveView("teams")}
            />
            <QuickCard
              icon="🗂"
              title="Full market"
              desc="Browse every duplicate card currently available from all players."
              badge={`${market.length} cards`}
              accent="neutral"
              onClick={() => setActiveView("market")}
            />
            <QuickCard
              icon="🎲"
              title="Danger Swap"
              desc="Challenge someone to swap a fully random card from each collection. No picks. Pure chaos."
              badge={incomingChallenges.length > 0 ? `${incomingChallenges.length} incoming` : "High risk"}
              accent="danger"
              onClick={() => setActiveView("danger")}
            />
          </div>

          {recentTrades.length > 0 ? (
            <section className="mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-white/40">Latest Swaps</p>
              <div className="space-y-2">
                {recentTrades.slice(0, 3).map((trade, i) => (
                  <RecentTradeRow key={i} trade={trade} playerById={playerById} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {/* ── BEST SWAPS ───────────────────────────────────────── */}
      {activeView === "recommended" ? (
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white/45">Best Swaps For Me</p>
              <p className="mt-1 text-sm font-semibold text-white/55">
                {bestSwapMode === "collections"
                  ? "Cards that complete teams and unlock boosts."
                  : "Highest-rated cards you don't own yet."}
              </p>
            </div>
            <div className="inline-flex gap-1 rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
              <ModeButton active={bestSwapMode === "collections"} onClick={() => setBestSwapMode("collections")}>
                Complete teams
              </ModeButton>
              <ModeButton active={bestSwapMode === "ranking"} onClick={() => setBestSwapMode("ranking")}>
                Top rated
              </ModeButton>
            </div>
          </div>
          <Showcase entries={activeBestSwaps.slice(0, 3)} playerById={playerById} progressByNation={progressByNation} mode={bestSwapMode} />
          <MarketList entries={activeBestSwaps} emptyText="No available duplicate currently improves your collection." {...sharedProps} />
        </section>
      ) : null}

      {/* ── PROPOSALS ───────────────────────────────────────── */}
      {activeView === "proposals" ? (
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white/45">Proposed Trades</p>
              <p className="mt-1 text-sm font-semibold text-white/55">Accept or reject incoming swaps. Withdraw your own sent proposals.</p>
            </div>
            <div className="inline-flex gap-1 rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
              <ModeButton active={proposalTab === "incoming"} onClick={() => setProposalTab("incoming")}>
                Incoming
                {incoming.length > 0 ? <span className="ml-1.5 rounded-full bg-amber-400/30 px-1.5 py-0.5 text-[9px] font-black text-amber-200">{incoming.length}</span> : null}
              </ModeButton>
              <ModeButton active={proposalTab === "sent"} onClick={() => setProposalTab("sent")}>
                Sent
                {outgoing.length > 0 ? <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-black">{outgoing.length}</span> : null}
              </ModeButton>
            </div>
          </div>
          {proposalTab === "incoming" ? (
            incoming.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-white/4 p-8 text-center text-sm font-semibold text-white/30">No incoming proposals right now.</div>
            ) : (
              <div className="space-y-3">
                {incoming.map((p) => (
                  <ProposalCard key={p.id} proposal={p} playerById={playerById} ownedIds={ownedIds} tradeBusy={tradeBusy} tradeAction={tradeAction} />
                ))}
              </div>
            )
          ) : (
            outgoing.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-white/4 p-8 text-center text-sm font-semibold text-white/30">You haven't sent any active proposals.</div>
            ) : (
              <div className="space-y-3">
                {outgoing.map((p) => (
                  <ProposalCard key={p.id} proposal={p} playerById={playerById} ownedIds={ownedIds} tradeBusy={tradeBusy} tradeAction={tradeAction} />
                ))}
              </div>
            )
          )}
        </section>
      ) : null}

      {/* ── FINISH A TEAM ────────────────────────────────────── */}
      {activeView === "teams" ? (
        <section>
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-widest text-white/45">Finish A Team</p>
            <p className="mt-1 text-sm font-semibold text-white/55">
              Complete any nation to unlock a <span className="font-black text-amber-300">+{COLLECTION_BOOST}</span> rating boost on all its players.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {missingTargets.map((progress) => (
              <NationTargetCard key={progress.nation} progress={progress} market={market} {...sharedProps} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── FULL MARKET ─────────────────────────────────────── */}
      {activeView === "market" ? (
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white/45">Full Duplicate Market</p>
              <p className="mt-1 text-sm font-semibold text-white/55">Every spare card is automatically listed here.</p>
            </div>
            <input
              className="rounded-xl border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white placeholder:text-white/30 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/25 sm:w-64"
              placeholder="Player, nation, rarity, user…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <MarketList entries={visibleMarket} emptyText="No matching duplicates are available right now." {...sharedProps} />
        </section>
      ) : null}

      {/* ── DANGER SWAP ─────────────────────────────────────── */}
      {activeView === "danger" ? (
        <DangerSwapView
          challenges={randomChallenges}
          log={randomLog}
          otherUsers={otherUsers}
          playerById={playerById}
          dangerTargetId={dangerTargetId}
          setDangerTargetId={setDangerTargetId}
          tradeBusy={tradeBusy}
          dangerAction={dangerAction}
        />
      ) : null}
    </div>
  );
}

// ── Tab navigation ────────────────────────────────────────────

function TabButton({ active, onClick, children, danger }: { active: boolean; onClick: () => void; children: ReactNode; danger?: boolean }) {
  const cls = danger
    ? active
      ? "bg-red-500 text-white shadow-sm shadow-red-900/40"
      : "text-red-400/80 hover:bg-red-500/15 hover:text-red-300"
    : active
    ? "bg-white text-green-950 shadow-sm"
    : "text-white/55 hover:bg-white/8 hover:text-white/80";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black transition ${cls}`}
    >
      {children}
    </button>
  );
}

// ── Home helpers ──────────────────────────────────────────────

function HeroStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ring-1 ${accent ? "bg-amber-400/15 ring-amber-400/30" : "bg-white/10 ring-white/15"}`}>
      <p className={`text-xl font-black tabular-nums leading-none ${accent ? "text-amber-200" : ""}`}>{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-white/50">{label}</p>
    </div>
  );
}

function QuickCard({
  icon, title, desc, badge, accent, onClick
}: {
  icon: string; title: string; desc: string; badge: string;
  accent: "green" | "amber" | "neutral" | "danger"; onClick: () => void;
}) {
  const card = {
    green: "border-green-500/25 bg-green-500/8 hover:bg-green-500/12",
    amber: "border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/15",
    neutral: "border-white/10 bg-white/5 hover:bg-white/8",
    danger: "border-red-500/30 bg-red-500/8 hover:bg-red-500/12"
  }[accent];
  const badgeCls = {
    green: "bg-green-500/20 text-green-300",
    amber: "bg-amber-400/20 text-amber-300",
    neutral: "bg-white/10 text-white/40",
    danger: "bg-red-500/20 text-red-300"
  }[accent];
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border p-5 text-left transition ${card}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-2xl leading-none">{icon}</span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${badgeCls}`}>{badge}</span>
      </div>
      <p className="mt-3 text-base font-black text-white">{title}</p>
      <p className="mt-1 text-sm font-semibold text-white/50">{desc}</p>
    </button>
  );
}

// ── Market ────────────────────────────────────────────────────

function MarketList({
  entries, playerById, ownedIds, duplicateCounts, myDuplicates, offerSelections, setOfferSelections,
  progressByNation, tradeBusy, tradeAction, emptyText
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
  if (entries.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-white/8 bg-white/4 p-6 text-center text-sm font-semibold text-white/35">
        {emptyText}
      </div>
    );
  }
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

function MarketCard({
  entry, playerById, ownedIds, duplicateCounts, myDuplicates, offerSelections, setOfferSelections,
  progressByNation, tradeBusy, tradeAction
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
  const alreadyOwned = ownedIds.has(entry.playerId);
  const matchingDuplicates = myDuplicates.filter((d) => d.id !== entry.playerId && d.rarity === player?.rarity);
  const rarity = player?.rarity ?? "common";
  const flag = flagUrl(player?.nation ?? "");

  return (
    <div className={`overflow-hidden rounded-2xl border ${RARITY_ACCENT[rarity] ?? RARITY_ACCENT.common}`}>
      <div className="flex items-start gap-3 p-4">
        <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ring-2 ${RARITY_RING[rarity] ?? RARITY_RING.common}`}>
          <span className={`text-xl font-black leading-none ${RARITY_COLOUR[rarity] ?? "text-white/80"}`}>{player?.rating ?? "?"}</span>
          <span className="text-[8px] font-black uppercase leading-none text-white/40">{player?.pos ?? ""}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {flag ? <img src={flag} alt="" className="h-3.5 w-5 shrink-0 rounded-sm object-cover" /> : null}
            <p className="truncate text-sm font-black text-white">{player?.name ?? `Player ${entry.playerId}`}</p>
          </div>
          <p className={`mt-0.5 text-[10px] font-black uppercase tracking-wide ${RARITY_COLOUR[rarity] ?? "text-white/50"}`}>{rarity}</p>
          <p className="mt-1 text-[10px] font-semibold text-white/40">{entry.username} · spare ×{entry.duplicateCount}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {alreadyOwned ? (
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-black text-white/35">Owned</span>
          ) : (
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] font-black text-green-300">Need this</span>
          )}
          {progress?.missing.length === 1 ? (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-black text-amber-300">Completes {player?.nation}</span>
          ) : null}
        </div>
      </div>

      {!alreadyOwned ? (
        <div className="flex items-center gap-2 border-t border-white/8 bg-white/4 px-4 py-3">
          {matchingDuplicates.length === 0 ? (
            <p className="flex-1 text-xs font-semibold text-white/30">No spare {rarity} to offer</p>
          ) : (
            <>
              <select
                className="min-w-0 flex-1 rounded-lg border border-white/12 bg-green-950 px-2 py-2 text-xs font-bold text-white focus:border-amber-400/50 focus:outline-none"
                value={selectedPlayerId ?? ""}
                onChange={(e) => setOfferSelections((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
              >
                <option value="" className="bg-green-950">Your spare {rarity}…</option>
                {matchingDuplicates.map((d) => (
                  <option key={d.id} value={d.id} className="bg-green-950">
                    {d.name} ×{duplicateCounts[d.id] ?? 0} · {d.nation}
                  </option>
                ))}
              </select>
              <button
                className="shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-xs font-black text-amber-950 transition hover:bg-amber-300 disabled:opacity-40"
                disabled={tradeBusy || !selectedPlayerId}
                onClick={() =>
                  selectedPlayerId &&
                  tradeAction(
                    { action: "propose", targetUserId: entry.userId, wantedPlayerId: entry.playerId, offeredPlayerId: selectedPlayerId },
                    "Trade proposed — it expires in 24 hours."
                  )
                }
              >
                Propose
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Showcase ──────────────────────────────────────────────────

function Showcase({
  entries, playerById, progressByNation, mode
}: {
  entries: MarketEntry[];
  playerById: Map<number, Player>;
  progressByNation: Map<string, NationProgress>;
  mode: BestSwapMode;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      {entries.map((entry, i) => {
        const player = playerById.get(entry.playerId);
        const progress = player ? progressByNation.get(player.nation) : undefined;
        const rarity = player?.rarity ?? "common";
        const flag = flagUrl(player?.nation ?? "");
        const helper =
          mode === "collections"
            ? progress?.missing.length === 1
              ? `Completes ${player?.nation}`
              : `${player?.nation ?? "Team"}: ${progress?.owned ?? 0}/${progress?.total ?? 0}`
            : `${player?.rating ?? "-"} rated ${rarity}`;
        return (
          <div key={`${entry.userId}:${entry.playerId}:sc`} className="overflow-hidden rounded-2xl bg-gradient-to-br from-green-950 to-green-800 p-4 ring-1 ring-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">#{i + 1} target</p>
            <div className="mt-3 flex items-center gap-3">
              <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ring-2 ${RARITY_RING[rarity] ?? RARITY_RING.common}`}>
                <span className={`text-xl font-black leading-none ${RARITY_COLOUR[rarity] ?? "text-white/80"}`}>{player?.rating ?? "?"}</span>
                <span className="text-[8px] font-black uppercase leading-none text-white/40">{player?.pos ?? ""}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {flag ? <img src={flag} alt="" className="h-3.5 w-5 shrink-0 rounded-sm object-cover" /> : null}
                  <p className="truncate text-sm font-black text-white">{player?.name ?? `Player ${entry.playerId}`}</p>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-white/55">{helper}</p>
                <p className="mt-1 text-[10px] font-black text-amber-300">{entry.username} ×{entry.duplicateCount} spare</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Proposals ─────────────────────────────────────────────────

function ProposalCard({
  proposal, playerById, ownedIds, tradeBusy, tradeAction
}: {
  proposal: DirectProposal;
  playerById: Map<number, Player>;
  ownedIds: Set<number>;
  tradeBusy: boolean;
  tradeAction: (body: Record<string, unknown>, successNotice: string) => Promise<void>;
}) {
  const offered = playerById.get(proposal.offeredPlayerId);
  const wanted = playerById.get(proposal.wantedPlayerId);
  // For incoming proposals: offeredPlayerId is what you'd receive
  const wouldReceiveDuplicate = proposal.isIncoming && ownedIds.has(proposal.offeredPlayerId);
  return (
    <div className={`overflow-hidden rounded-2xl border ${proposal.isIncoming ? "border-amber-400/25 bg-amber-950/15" : "border-white/10 bg-white/5"}`}>
      {/* Meta row */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <div className="flex items-center gap-2">
          {proposal.isIncoming ? (
            <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-300">Incoming</span>
          ) : (
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white/40">Sent</span>
          )}
          <span className="text-xs font-semibold text-white/40">
            {proposal.isIncoming ? `from ${proposal.proposerUsername}` : `to ${proposal.targetUsername}`}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-white/30">Expires {formatExpiry(proposal.expiresAt)}</span>
      </div>

      {/* Swap display */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
        <ProposalPlayerChip player={offered} label={proposal.isIncoming ? `${proposal.proposerUsername} gives` : "You give"} />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-black text-white/15">⇄</span>
        </div>
        <ProposalPlayerChip player={wanted} label={proposal.isIncoming ? "You receive" : `${proposal.targetUsername} gives`} />
      </div>

      {/* Already-owned warning */}
      {wouldReceiveDuplicate ? (
        <div className="mx-4 mt-3 rounded-xl bg-amber-400/10 px-3 py-2 ring-1 ring-amber-400/25">
          <p className="text-xs font-black text-amber-300">⚠ You already own {offered?.name ?? "this player"} — accepting gives you a duplicate.</p>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-4 flex gap-2 border-t border-white/8 px-4 py-3">
        {proposal.isIncoming ? (
          <>
            <button
              className="flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-black text-amber-950 transition hover:bg-amber-300 disabled:opacity-40"
              onClick={() => tradeAction({ action: "confirm", proposalId: proposal.id }, "Trade complete.")}
              disabled={tradeBusy}
            >
              Accept swap
            </button>
            <button
              className="rounded-xl bg-white/8 px-5 py-2.5 text-sm font-black text-white/45 transition hover:bg-white/12 disabled:opacity-40"
              onClick={() => tradeAction({ action: "decline", proposalId: proposal.id }, "Proposal rejected.")}
              disabled={tradeBusy}
            >
              Decline
            </button>
          </>
        ) : (
          <button
            className="rounded-xl bg-white/8 px-5 py-2.5 text-sm font-black text-white/45 transition hover:bg-white/12 disabled:opacity-40"
            onClick={() => tradeAction({ action: "withdraw", proposalId: proposal.id }, "Proposal withdrawn.")}
            disabled={tradeBusy}
          >
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}

function ProposalPlayerChip({ player, label }: { player: Player | undefined; label: string }) {
  const flag = flagUrl(player?.nation ?? "");
  const rarity = player?.rarity ?? "common";
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white/6 p-3 ring-1 ring-white/8">
      <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ring-2 ${RARITY_RING[rarity] ?? RARITY_RING.common}`}>
        <span className={`text-lg font-black leading-none ${RARITY_COLOUR[rarity] ?? "text-white/80"}`}>{player?.rating ?? "?"}</span>
        <span className="text-[8px] font-black uppercase leading-none text-white/35">{player?.pos ?? ""}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wide text-white/30">{label}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {flag ? <img src={flag} alt="" className="h-3.5 w-5 shrink-0 rounded-sm object-cover" /> : null}
          <p className="truncate text-sm font-black text-white/90">{player?.name ?? "Unknown"}</p>
        </div>
        {player ? (
          <p className={`mt-0.5 text-[10px] font-bold uppercase ${RARITY_COLOUR[rarity] ?? "text-white/40"}`}>{player.nation} · {rarity}</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Nation targets ────────────────────────────────────────────

function NationTargetCard({
  progress, market, playerById, ownedIds, duplicateCounts, myDuplicates, offerSelections,
  setOfferSelections, progressByNation: _progressByNation, tradeBusy, tradeAction
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
  const almostDone = progress.missing.length === 1;

  return (
    <div className={`overflow-hidden rounded-2xl border ${almostDone ? "border-amber-400/25 bg-amber-950/15" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-2.5">
          {flag ? <img src={flag} alt="" className="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" /> : null}
          <div>
            <p className="font-black text-white">{progress.nation}</p>
            <p className="text-[10px] font-semibold text-white/40">{progress.owned}/{progress.total} collected</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${almostDone ? "bg-amber-400/20 text-amber-300" : "bg-white/8 text-white/40"}`}>
          {progress.missing.length} to go
        </span>
      </div>

      <div className="mx-4 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${almostDone ? "bg-amber-400" : "bg-pitch"}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mt-3 divide-y divide-white/6">
        {(() => {
          const available = progress.missing.filter((p) => market.some((e) => e.playerId === p.id)).slice(0, 5);
          const unavailableCount = progress.missing.length - available.length;
          if (available.length === 0) {
            return (
              <div className="px-4 py-4 text-sm font-semibold text-white/30">
                None of the {progress.missing.length} missing player{progress.missing.length === 1 ? "" : "s"} are currently listed for trade.
              </div>
            );
          }
          return (
            <>
              {available.map((missingPlayer) => {
          const matchingEntries = market.filter((e) => e.playerId === missingPlayer.id);
          // Key for "which duplicate am I offering" selection
          const offerKey = `offer:${missingPlayer.id}`;
          // Key for "which provider am I targeting" — only needed when >1 has it
          const targetKey = `target:${missingPlayer.id}`;
          const selectedPlayerId = offerSelections[offerKey];
          const selectedTargetUserId = offerSelections[targetKey] ?? matchingEntries[0]?.userId;
          const targetEntry = matchingEntries.find((e) => e.userId === selectedTargetUserId) ?? matchingEntries[0];
          const matchingDuplicates = myDuplicates.filter((d) => d.id !== missingPlayer.id && d.rarity === missingPlayer.rarity);
          const rarity = missingPlayer.rarity;
          const pFlag = flagUrl(missingPlayer.nation);
          const multipleProviders = matchingEntries.length > 1;

          return (
            <div key={missingPlayer.id} className="px-4 py-3">
              {/* Player info row */}
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg ring-2 ${RARITY_RING[rarity] ?? RARITY_RING.common}`}>
                  <span className={`text-sm font-black leading-none ${RARITY_COLOUR[rarity] ?? "text-white/80"}`}>{missingPlayer.rating}</span>
                  <span className="text-[7px] font-black uppercase leading-none text-white/35">{missingPlayer.pos}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {pFlag ? <img src={pFlag} alt="" className="h-3 w-4 shrink-0 rounded-sm object-cover" /> : null}
                    <p className="truncate text-sm font-black text-white/85">{missingPlayer.name}</p>
                  </div>
                  <p className={`mt-0.5 text-[10px] font-bold uppercase ${RARITY_COLOUR[rarity] ?? "text-white/40"}`}>{rarity}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[10px] font-black text-green-300">
                    {matchingEntries.length === 1
                      ? `${matchingEntries[0].username} has spare`
                      : `${matchingEntries.length} players have spare`}
                  </span>
                </div>
              </div>

              {/* Offer row */}
              <div className="mt-2.5 space-y-2 rounded-xl bg-white/5 p-2 ring-1 ring-white/8">
                {/* If multiple providers, let user pick which one */}
                {multipleProviders ? (
                  <select
                    className="w-full rounded-lg border border-white/12 bg-green-950 px-2 py-1.5 text-xs font-bold text-white focus:border-amber-400/50 focus:outline-none"
                    value={selectedTargetUserId ?? ""}
                    onChange={(e) => setOfferSelections((prev) => ({ ...prev, [targetKey]: Number(e.target.value) }))}
                  >
                    {matchingEntries.map((e) => (
                      <option key={e.userId} value={e.userId} className="bg-green-950">
                        Get from {e.username} (×{e.duplicateCount} spare)
                      </option>
                    ))}
                  </select>
                ) : null}
                {matchingDuplicates.length === 0 ? (
                  <p className="px-1 text-xs font-semibold text-white/30">No spare {rarity} to offer in return</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      className="min-w-0 flex-1 rounded-lg border border-white/12 bg-green-950 px-2 py-2 text-xs font-bold text-white focus:border-amber-400/50 focus:outline-none"
                      value={selectedPlayerId ?? ""}
                      onChange={(e) => setOfferSelections((prev) => ({ ...prev, [offerKey]: Number(e.target.value) }))}
                    >
                      <option value="" className="bg-green-950">Your spare {rarity}…</option>
                      {matchingDuplicates.map((d) => (
                        <option key={d.id} value={d.id} className="bg-green-950">
                          {d.name} ×{duplicateCounts[d.id] ?? 0} · {d.nation}
                        </option>
                      ))}
                    </select>
                    <button
                      className="shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-xs font-black text-amber-950 transition hover:bg-amber-300 disabled:opacity-40"
                      disabled={tradeBusy || !selectedPlayerId || !targetEntry}
                      onClick={() =>
                        selectedPlayerId &&
                        targetEntry &&
                        tradeAction(
                          { action: "propose", targetUserId: targetEntry.userId, wantedPlayerId: missingPlayer.id, offeredPlayerId: selectedPlayerId },
                          "Trade proposed — it expires in 24 hours."
                        )
                      }
                    >
                      Propose
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
              {unavailableCount > 0 ? (
                <div className="border-t border-white/6 px-4 py-2.5 text-[11px] font-semibold text-white/30">
                  +{unavailableCount} more missing but not currently listed for trade
                </div>
              ) : null}
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ── Recent trades ─────────────────────────────────────────────

function RecentTradeRow({ trade, playerById }: { trade: RecentTrade; playerById: Map<number, Player> }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/8">
      <span className="text-xs font-black text-white/65">{trade.offererUsername}</span>
      <MiniChip player={playerById.get(trade.playerId)} />
      <span className="text-[10px] font-black text-white/20">⇄</span>
      <MiniChip player={playerById.get(trade.acceptedPlayerId)} />
      <span className="text-xs font-black text-white/65">{trade.acceptorUsername}</span>
    </div>
  );
}

function MiniChip({ player }: { player: Player | undefined }) {
  if (!player) return <span className="rounded bg-white/8 px-1.5 py-0.5 text-xs font-bold text-white/30">?</span>;
  const flag = flagUrl(player.nation);
  const rarity = player.rarity;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${RARITY_ACCENT[rarity] ?? RARITY_ACCENT.common} ${RARITY_COLOUR[rarity] ?? "text-white/60"}`}>
      {flag ? <img src={flag} alt="" className="h-2.5 w-3.5 rounded-sm object-cover" /> : null}
      {player.name} {player.rating}
    </span>
  );
}

// ── Mode toggle ───────────────────────────────────────────────

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${active ? "bg-white text-green-950 shadow-sm" : "text-white/45 hover:text-white/70"}`}
    >
      {children}
    </button>
  );
}

// ── Danger Swap ───────────────────────────────────────────────

function DangerSwapView({
  challenges, log, otherUsers, playerById, dangerTargetId, setDangerTargetId, tradeBusy, dangerAction
}: {
  challenges: RandomChallenge[];
  log: RandomLogEntry[];
  otherUsers: { id: number; username: string }[];
  playerById: Map<number, Player>;
  dangerTargetId: number;
  setDangerTargetId: (id: number) => void;
  tradeBusy: boolean;
  dangerAction: (body: Record<string, unknown>, successNotice: string) => Promise<void>;
}) {
  const incoming = challenges.filter((c) => c.isIncoming);
  const outgoing = challenges.filter((c) => c.isMine);

  return (
    <section className="space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-950/70 via-red-900/20 to-black/40 p-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.12),transparent_60%)]" />
        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400/60">Danger Zone</p>
          <h2 className="mt-1 text-xl font-black text-white">Random Swap</h2>
          <p className="mt-1.5 text-sm font-semibold text-white/45">
            No picks. No previews. One random card each — gone before you know what it was.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {["Locked XI protected", "Completed nations protected", "Everything else is fair game"].map((r) => (
              <span key={r} className="flex items-center gap-1.5 text-xs font-semibold text-red-300/50">
                <span className="h-1 w-1 rounded-full bg-red-500/50" />{r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Incoming challenges — surfaced prominently */}
      {incoming.map((c) => (
        <div key={c.id} className="overflow-hidden rounded-2xl border border-red-500/35 bg-red-950/30">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-red-400/70">Challenge incoming</p>
              <p className="mt-0.5 text-sm font-black text-white">
                <span className="text-red-300">{c.challengerUsername}</span> wants a Danger Swap
              </p>
            </div>
            <span className="text-xl">🎲</span>
          </div>
          <div className="flex gap-2 border-t border-red-500/15 px-4 py-3">
            <button
              className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-40"
              disabled={tradeBusy}
              onClick={() => dangerAction({ action: "accept", swapId: c.id }, "Swap done — cards lost, cards gained.")}
            >
              Accept
            </button>
            <button
              className="rounded-xl bg-white/6 px-5 py-2.5 text-sm font-semibold text-white/35 transition hover:bg-white/10 disabled:opacity-40"
              disabled={tradeBusy}
              onClick={() => dangerAction({ action: "decline", swapId: c.id }, "Challenge declined.")}
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      {/* Issue challenge */}
      <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-white/30">Issue a Challenge</p>
        <div className="flex gap-2">
          <select
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-green-950 px-3 py-2.5 text-sm font-bold text-white focus:border-red-400/50 focus:outline-none"
            value={dangerTargetId || ""}
            onChange={(e) => setDangerTargetId(Number(e.target.value))}
          >
            <option value="" className="bg-green-950">Pick an opponent…</option>
            {otherUsers.map((u) => (
              <option key={u.id} value={u.id} className="bg-green-950">{u.username}</option>
            ))}
          </select>
          <button
            className="shrink-0 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-40"
            disabled={tradeBusy || !dangerTargetId}
            onClick={() => dangerTargetId && dangerAction({ action: "challenge", targetId: dangerTargetId }, "Challenge sent.")}
          >
            Challenge
          </button>
        </div>
      </div>

      {/* Sent challenges */}
      {outgoing.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-white/25">Awaiting response</p>
          {outgoing.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/4 px-4 py-3">
              <p className="text-sm font-semibold text-white/55">
                Waiting on <span className="font-black text-white/80">{c.targetUsername}</span>
              </p>
              <button
                className="rounded-lg bg-white/6 px-3 py-1.5 text-xs font-black text-white/35 hover:bg-white/10 disabled:opacity-40"
                disabled={tradeBusy}
                onClick={() => dangerAction({ action: "withdraw", swapId: c.id }, "Challenge withdrawn.")}
              >
                Withdraw
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Public log */}
      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-white/25">Swap Log</p>
        {log.length === 0 ? (
          <div className="rounded-xl border border-white/6 bg-white/3 p-6 text-center text-sm font-semibold text-white/20">
            No danger swaps yet.
          </div>
        ) : (
          <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/8 bg-white/4">
            {log.map((entry) => {
              const cPlayer = playerById.get(entry.challengerPlayerId);
              const tPlayer = playerById.get(entry.targetPlayerId);
              return (
                <div key={entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3">
                  <span className="text-xs font-black text-white/60">{entry.challengerUsername}</span>
                  <span className="text-[10px] text-white/20">↓</span>
                  <MiniChip player={cPlayer} />
                  <span className="text-[10px] font-black text-red-500/50 mx-0.5">🎲</span>
                  <span className="text-xs font-black text-white/60">{entry.targetUsername}</span>
                  <span className="text-[10px] text-white/20">↓</span>
                  <MiniChip player={tPlayer} />
                  <span className="ml-auto text-[10px] font-semibold text-white/20 tabular-nums">
                    {new Date(entry.completedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
