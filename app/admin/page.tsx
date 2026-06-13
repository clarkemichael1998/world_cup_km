"use client";

import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import players from "@/data/players.json";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import { activityDefinitions } from "@/lib/rewardEngine";
import type { ActivityType, Player, Position } from "@/lib/types";

type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";

type SubmittedResult = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  winner: string | null;
  status: MatchStatus;
  matchDate: string;
  ok: boolean;
  error?: string;
};

type GoalScorerRow = {
  id: number;
  match_id: string;
  scorer_name_raw: string;
  player_id: number | null;
  goal_count: number;
  status: string;
  source: string;
  home_team: string | null;
  away_team: string | null;
  match_date: string | null;
};

type ActivityLogRow = {
  id: number;
  username: string;
  distance_km: number;
  activity_type: ActivityType;
  activity_amount: number | null;
  activity_unit: string | null;
  comment: string | null;
  cards_earned: number;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  awards: Array<{ player_id: number }>;
};

type NewsReel = {
  message: string;
  isActive: boolean;
  updatedAt: string | null;
};

type LateCallupPlayer = Player;

type RatingAdjustmentRow = {
  id: number;
  playerId: number;
  playerName: string;
  playerNation: string;
  playerClub: string;
  adjustment: number;
  reason: string;
  createdByUsername: string;
  createdAt: string;
  chatMessageId: number | null;
  ratingBefore: number;
  ratingAfter: number;
};

type MatchMonitorFixture = {
  matchId: string;
  matchDate: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  winner: string | null;
  status: string;
  source: string;
  verified: boolean;
  updatedAt: string | null;
  rewardCount: number;
  creditTotal: number;
  goalRecords: number;
  matchedGoalRecords: number;
  assistRecords: number;
  matchedAssistRecords: number;
};

type MatchMonitorData = {
  providerStatus: { provider: string; status: string; message: string; checkedAt: string } | null;
  fixtures: MatchMonitorFixture[];
};

const playerMap = new Map((players as Player[]).map((player) => [player.id, player]));

const WC_TEAMS = [
  "Argentina", "Australia", "Belgium", "Brazil", "Cameroon", "Canada",
  "Chile", "Colombia", "Costa Rica", "Croatia", "Czech Republic", "Denmark",
  "Ecuador", "Egypt", "England", "France", "Germany", "Ghana", "Greece",
  "Honduras", "Hungary", "Indonesia", "Iran", "Italy", "Ivory Coast",
  "Jamaica", "Japan", "Kenya", "Malaysia", "Mexico", "Morocco", "Netherlands",
  "New Zealand", "Nigeria", "Panama", "Paraguay", "Peru", "Poland",
  "Portugal", "Qatar", "Romania", "Saudi Arabia", "Senegal", "Serbia",
  "Slovenia", "South Africa", "South Korea", "Spain", "Switzerland",
  "Thailand", "Tunisia", "Turkey", "Ukraine", "United States", "Uruguay",
  "Venezuela", "Vietnam", "DR Congo",
].sort();

const today = new Date().toISOString().slice(0, 10);

export default function AdminPage() {
  const [tab, setTab] = useState<"results" | "goalscorers" | "activity" | "news" | "players" | "ratings" | "settle" | "monitor">("results");
  const [forbidden, setForbidden] = useState(false);

  if (forbidden) {
    return (
      <div>
        <PageTitle title="Admin" subtitle="Results management" />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="font-bold text-red-900">Access denied. You must be logged in as the admin account.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Admin" subtitle="Tournament management" />

      <div className="mb-6 flex flex-wrap gap-2">
        {(["results", "monitor", "goalscorers", "activity", "news", "players", "ratings", "settle"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-black transition-colors ${tab === t ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}
          >
            {t === "results" ? "Match Results" : t === "monitor" ? "Match Monitor" : t === "goalscorers" ? "Goal Scorers" : t === "activity" ? "Activity Review" : t === "news" ? "News Reel" : t === "players" ? "Late Call-Ups" : t === "ratings" ? "Viral Ratings" : "Live Settle"}
          </button>
        ))}
      </div>

      {tab === "results" && <ResultsTab onForbidden={() => setForbidden(true)} />}
      {tab === "monitor" && <MatchMonitorTab onForbidden={() => setForbidden(true)} />}
      {tab === "goalscorers" && <GoalScorersTab onForbidden={() => setForbidden(true)} />}
      {tab === "activity" && <ActivityReviewTab onForbidden={() => setForbidden(true)} />}
      {tab === "news" && <NewsReelTab onForbidden={() => setForbidden(true)} />}
      {tab === "players" && <LateCallupsTab onForbidden={() => setForbidden(true)} />}
      {tab === "ratings" && <ViralRatingsTab onForbidden={() => setForbidden(true)} />}
      {tab === "settle" && <LiveSettleTab onForbidden={() => setForbidden(true)} />}
    </div>
  );
}

function MatchMonitorTab({ onForbidden }: { onForbidden: () => void }) {
  const [data, setData] = useState<MatchMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/match-monitor", { credentials: "include" });
      if (res.status === 403) { onForbidden(); return; }
      const payload = (await res.json()) as MatchMonitorData & { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Could not load match monitor.");
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-sm font-semibold text-green-900/60">Loading match monitor...</p>;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Provider Status</p>
            <p className="mt-1 text-sm font-semibold text-green-900/65">
              {data?.providerStatus ? `${data.providerStatus.provider} - ${data.providerStatus.status}` : "No provider run yet."}
            </p>
            {data?.providerStatus?.message ? <p className="mt-1 text-xs font-semibold text-green-900/50">{data.providerStatus.message}</p> : null}
            {data?.providerStatus?.checkedAt ? <p className="mt-1 text-xs font-bold text-green-900/40">Checked {new Date(data.providerStatus.checkedAt).toLocaleString("en-GB")}</p> : null}
          </div>
          <button onClick={load} className="rounded-md bg-pitch px-4 py-2 text-sm font-black text-white hover:bg-green-800">Refresh</button>
        </div>
      </div>

      {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-green-900/10 bg-white shadow-sm">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-green-900/10 bg-green-950/5 text-left text-xs font-bold uppercase tracking-wide text-green-900/60">
              <th className="px-3 py-3">Fixture</th>
              <th className="px-3 py-3">Kickoff</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">Winner</th>
              <th className="px-3 py-3 text-right">Rewards</th>
              <th className="px-3 py-3 text-right">Goals</th>
              <th className="px-3 py-3 text-right">Assists</th>
            </tr>
          </thead>
          <tbody>
            {(data?.fixtures ?? []).map((fixture) => (
              <tr key={fixture.matchId} className="border-b border-green-900/10 last:border-0">
                <td className="px-3 py-3">
                  <p className="font-black text-green-950">{fixture.homeTeam} vs {fixture.awayTeam}</p>
                  <p className="text-[10px] font-bold text-green-900/45">{fixture.matchId}</p>
                </td>
                <td className="px-3 py-3 font-semibold text-green-900/70">{new Date(fixture.kickoffAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${fixture.status === "FINISHED" ? "bg-green-100 text-green-800" : fixture.status === "LIVE" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>
                    {fixture.status}
                  </span>
                  <span className={`ml-1 rounded-full px-2 py-1 text-[10px] font-black uppercase ${fixture.verified ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                    {fixture.verified ? "Counts" : "Not counted"}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs font-bold text-green-900/60">{fixture.source}</td>
                <td className="px-3 py-3 font-bold text-green-950">{fixture.winner ?? (fixture.status === "FINISHED" ? "Draw / none" : "-")}</td>
                <td className="px-3 py-3 text-right font-black text-amber-700">{fixture.rewardCount} / {fixture.creditTotal}</td>
                <td className="px-3 py-3 text-right font-bold text-green-800">{fixture.matchedGoalRecords}/{fixture.goalRecords}</td>
                <td className="px-3 py-3 text-right font-bold text-sky-800">{fixture.matchedAssistRecords}/{fixture.assistRecords}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LiveSettleTab({ onForbidden }: { onForbidden: () => void }) {
  const [busy, setBusy] = useState(false);
  const [resyncBusy, setResyncBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function settle() {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/admin/settle-live", { method: "POST", credentials: "include" });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json().catch(() => ({}))) as {
        usersSettled?: number;
        providerStatus?: { status: string; message: string };
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not settle live awards.");
        return;
      }
      setNotice(`Settled ${data.usersSettled ?? 0} users. Fixture sync: ${data.providerStatus?.status ?? "unknown"} - ${data.providerStatus?.message ?? "No provider message."}`);
    } finally {
      setBusy(false);
    }
  }

  async function resyncGoals(force: boolean) {
    if (resyncBusy) return;
    setResyncBusy(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/admin/resync-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force })
      });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json().catch(() => ({}))) as {
        matchesChecked?: number;
        goalsFound?: number;
        remaining?: number;
        usersSettled?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not resync goals.");
        return;
      }
      const more = (data.remaining ?? 0) > 0 ? ` Run again to fetch the remaining ${data.remaining}.` : "";
      setNotice(`${data.message ?? ""} Re-settled ${data.usersSettled ?? 0} users.${more}`);
    } finally {
      setResyncBusy(false);
    }
  }

  return (
    <section className="max-w-2xl rounded-lg border border-green-900/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Live Match Settlement</p>
      <p className="mt-2 text-sm font-semibold text-green-900/65">
        Sync fixtures, settle win credits for every locked squad, and apply goal/assist rating boosts for every user. Safe to run more than once.
      </p>

      <button
        onClick={settle}
        disabled={busy}
        className="mt-5 rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800 disabled:opacity-40"
      >
        {busy ? "Settling..." : "Sync Fixtures & Settle All Users"}
      </button>

      <div className="mt-6 border-t border-green-900/10 pt-5">
        <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Retroactive Goal &amp; Assist Boosts</p>
        <p className="mt-2 text-sm font-semibold text-green-900/65">
          Pulls scorer detail for finished matches since the tournament start and re-applies goal/assist boosts to every user&apos;s past locked squads. Fetches a batch per click (API rate limit) — keep clicking until it reports 0 remaining.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => resyncGoals(false)}
            disabled={resyncBusy}
            className="rounded-md bg-amber-600 px-5 py-3 font-black text-white hover:bg-amber-700 disabled:opacity-40"
          >
            {resyncBusy ? "Resyncing..." : "Resync Goals & Apply Boosts"}
          </button>
          <button
            onClick={() => resyncGoals(true)}
            disabled={resyncBusy}
            className="rounded-md border border-amber-300 bg-white px-5 py-3 font-black text-amber-800 hover:bg-amber-50 disabled:opacity-40"
          >
            Force re-check all
          </button>
        </div>
        <p className="mt-2 text-xs font-semibold text-green-900/55">
          &quot;Force re-check all&quot; re-fetches finished matches even if they previously returned no goals — use it to diagnose whether the API is supplying scorer data at all.
        </p>
      </div>

      {notice ? <p className="mt-4 rounded-md bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
    </section>
  );
}

function LateCallupsTab({ onForbidden }: { onForbidden: () => void }) {
  const [form, setForm] = useState({
    name: "",
    nation: "England",
    pos: "MF" as Position,
    club: "",
    rating: "68",
    dob: "",
    caps: "0",
    goals: "0",
    wiki: "",
    clubWiki: "",
    clubCountry: "ENG",
    teamId: "england"
  });
  const [players, setPlayers] = useState<LateCallupPlayer[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/players", { credentials: "include" });
    if (res.status === 403) { onForbidden(); return; }
    const data = (await res.json()) as { players?: LateCallupPlayer[]; error?: string };
    if (res.ok) setPlayers(data.players ?? []);
  }

  useEffect(() => { load(); }, []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice("");
    setError("");
  }

  function updateNation(nation: string) {
    setForm((current) => ({ ...current, nation, teamId: teamIdFromNation(nation) }));
    setNotice("");
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          rating: Number(form.rating),
          caps: form.caps === "" ? null : Number(form.caps),
          goals: form.goals === "" ? null : Number(form.goals)
        })
      });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json()) as { player?: LateCallupPlayer; players?: LateCallupPlayer[]; error?: string };
      if (!res.ok || !data.player) {
        setError(data.error ?? "Could not create player.");
        return;
      }
      setPlayers(data.players ?? [data.player, ...players]);
      setNotice(`${data.player.name} added as #${data.player.id} (${data.player.rating} ${data.player.rarity}).`);
      setForm((current) => ({ ...current, name: "", club: "", rating: "68", dob: "", caps: "0", goals: "0", wiki: "", clubWiki: "" }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Late Call-Up</p>
          <p className="mt-1 text-sm font-semibold text-green-900/60">Adds a player to the live app database. No code access needed.</p>
        </div>

        <Field label="Player Name">
          <input value={form.name} onChange={(e) => update("name", e.target.value)} minLength={2} autoComplete="name"
            className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nation">
            <select value={form.nation} onChange={(e) => updateNation(e.target.value)}
              className="w-full rounded-md border border-green-900/20 bg-white px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required>
              {WC_TEAMS.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
          </Field>
          <Field label="Position">
            <select value={form.pos} onChange={(e) => update("pos", e.target.value as Position)}
              className="w-full rounded-md border border-green-900/20 bg-white px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required>
              <option value="GK">GK</option>
              <option value="DF">DF</option>
              <option value="MF">MF</option>
              <option value="FW">FW</option>
            </select>
          </Field>
        </div>

        <Field label="Club">
          <input value={form.club} onChange={(e) => update("club", e.target.value)}
            className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Rating">
            <input type="number" min={1} max={99} step={1} value={form.rating} onChange={(e) => update("rating", e.target.value)}
              className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
          <Field label="DOB">
            <input type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)}
              className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
          <Field label="Club Country">
            <input value={form.clubCountry} onChange={(e) => update("clubCountry", e.target.value.toUpperCase().slice(0, 3))} maxLength={3}
              className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold uppercase text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Team ID">
            <input value={form.teamId} onChange={(e) => update("teamId", e.target.value.toLowerCase())}
              className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
          <Field label="Caps">
            <input type="number" min={0} step={1} value={form.caps} onChange={(e) => update("caps", e.target.value)}
              className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          </Field>
          <Field label="Goals">
            <input type="number" min={0} step={1} value={form.goals} onChange={(e) => update("goals", e.target.value)}
              className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          </Field>
        </div>

        <Field label="Player Wiki URL">
          <input type="url" value={form.wiki} onChange={(e) => update("wiki", e.target.value)} placeholder="https://..."
            className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
        </Field>
        <Field label="Club Wiki URL">
          <input type="url" value={form.clubWiki} onChange={(e) => update("clubWiki", e.target.value)} placeholder="https://..."
            className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
        </Field>

        {notice ? <p className="rounded-md bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

        <button type="submit" disabled={saving}
          className="w-full rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800 disabled:opacity-40">
          {saving ? "Adding..." : "Add Player"}
        </button>
      </form>

      <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Created This Way</p>
            <p className="mt-1 text-sm font-semibold text-green-900/60">{players.length} late call-up{players.length === 1 ? "" : "s"} in the app database.</p>
          </div>
          <button onClick={load} className="rounded-md bg-green-950/8 px-3 py-2 text-xs font-black text-green-950 hover:bg-green-950/15">Refresh</button>
        </div>
        <div className="mt-4 space-y-2">
          {players.length === 0 ? (
            <p className="rounded-md bg-green-950/5 p-3 text-sm font-bold text-green-900/60">No late call-ups added yet.</p>
          ) : players.map((player) => (
            <div key={player.id} className="rounded-md border border-green-900/10 bg-green-950/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-green-950">#{player.id} {player.name}</p>
                  <p className="truncate text-xs font-semibold text-green-900/60">{player.nation} - {player.club} - {player.pos}</p>
                </div>
                <span className="rounded-md bg-gold px-2 py-1 text-xs font-black text-green-950">{player.rating}</span>
              </div>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-green-900/45">{player.rarity} - {player.teamId}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ViralRatingsTab({ onForbidden }: { onForbidden: () => void }) {
  const [players, setPlayers] = useState<Player[]>(basePlayerPool);
  const [adjustments, setAdjustments] = useState<RatingAdjustmentRow[]>([]);
  const [query, setQuery] = useState("");
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [adjustment, setAdjustment] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [playerPool, adjustmentRes] = await Promise.all([
      loadPlayerPool(),
      fetch("/api/admin/rating-adjustments", { credentials: "include" })
    ]);
    setPlayers(playerPool);
    if (adjustmentRes.status === 403) { onForbidden(); return; }
    const data = (await adjustmentRes.json()) as { adjustments?: RatingAdjustmentRow[]; error?: string };
    if (adjustmentRes.ok) setAdjustments(data.adjustments ?? []);
  }

  useEffect(() => { load(); }, []);

  const filteredPlayers = players
    .filter((player) => {
      const normalized = query.trim().toLowerCase();
      return !normalized || `${player.name} ${player.nation} ${player.club} ${player.id}`.toLowerCase().includes(normalized);
    })
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
    .slice(0, 20);
  const selectedPlayer = players.find((player) => player.id === playerId) ?? null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/admin/rating-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playerId, adjustment: Number(adjustment), reason })
      });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json()) as { adjustment?: RatingAdjustmentRow; adjustments?: RatingAdjustmentRow[]; error?: string };
      if (!res.ok || !data.adjustment) {
        setError(data.error ?? "Could not apply rating change.");
        return;
      }
      setAdjustments(data.adjustments ?? [data.adjustment, ...adjustments]);
      setNotice(`${data.adjustment.playerName} moved ${signedAdjustment(data.adjustment.adjustment)} to ${data.adjustment.ratingAfter}. Chat announcement posted.`);
      setReason("");
      setAdjustment("1");
      const playerPool = await loadPlayerPool();
      setPlayers(playerPool);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Viral Rating Change</p>
          <p className="mt-1 text-sm font-semibold text-green-900/60">Boost or downgrade a player for a World Cup moment. Every change is logged and posted to chat.</p>
        </div>

        <Field label="Find Player">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by player, nation, club, or ID"
            className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
        </Field>

        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-green-900/10 bg-green-950/5 p-2">
          {filteredPlayers.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => {
                setPlayerId(player.id);
                setQuery(player.name);
                setNotice("");
                setError("");
              }}
              className={`w-full rounded-md border px-3 py-2 text-left ${playerId === player.id ? "border-pitch bg-white ring-2 ring-green-700/20" : "border-transparent bg-white/70 hover:border-green-900/20"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-green-950">#{player.id} {player.name}</p>
                  <p className="truncate text-xs font-semibold text-green-900/60">{player.nation} - {player.club} - {player.pos}</p>
                </div>
                <span className="rounded-md bg-gold px-2 py-1 text-xs font-black text-green-950">{player.rating}</span>
              </div>
            </button>
          ))}
        </div>

        {selectedPlayer ? (
          <div className="rounded-md bg-green-950/5 p-3 text-sm font-bold text-green-950">
            Selected: {selectedPlayer.name} ({selectedPlayer.rating})
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Change">
            <input type="number" min={-20} max={20} step={1} value={adjustment} onChange={(e) => setAdjustment(e.target.value)}
              className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
          <Field label="Reason">
            <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 180))} minLength={3} maxLength={180} placeholder="e.g. bicycle kick went viral"
              className="w-full rounded-md border border-green-900/20 px-3 py-3 text-base font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
        </div>

        {notice ? <p className="rounded-md bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

        <button type="submit" disabled={saving || !playerId || !reason.trim() || Number(adjustment) === 0}
          className="w-full rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800 disabled:opacity-40">
          {saving ? "Applying..." : Number(adjustment) < 0 ? "Apply Downgrade" : "Apply Boost"}
        </button>
      </form>

      <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Admin Log</p>
            <p className="mt-1 text-sm font-semibold text-green-900/60">{adjustments.length} recent rating change{adjustments.length === 1 ? "" : "s"}.</p>
          </div>
          <button onClick={load} className="rounded-md bg-green-950/8 px-3 py-2 text-xs font-black text-green-950 hover:bg-green-950/15">Refresh</button>
        </div>
        <div className="mt-4 space-y-2">
          {adjustments.length === 0 ? (
            <p className="rounded-md bg-green-950/5 p-3 text-sm font-bold text-green-900/60">No viral rating changes yet.</p>
          ) : adjustments.map((item) => (
            <div key={item.id} className="rounded-md border border-green-900/10 bg-green-950/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-green-950">{item.playerName}</p>
                  <p className="truncate text-xs font-semibold text-green-900/60">{item.playerNation} - {item.playerClub}</p>
                </div>
                <span className={`rounded-md px-2 py-1 text-xs font-black ${item.adjustment > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {signedAdjustment(item.adjustment)}
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-green-950">{item.ratingBefore} to {item.ratingAfter}</p>
              <p className="mt-1 text-xs font-semibold text-green-900/70">{item.reason}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-green-900/45">
                {new Date(item.createdAt).toLocaleString("en-GB")} - {item.createdByUsername}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function NewsReelTab({ onForbidden }: { onForbidden: () => void }) {
  const [message, setMessage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/news", { credentials: "include" });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json()) as { news?: NewsReel; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load news reel.");
        return;
      }
      setMessage(data.news?.message ?? "");
      setIsActive(data.news?.isActive !== false);
      setUpdatedAt(data.news?.updatedAt ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim() || saving) return;
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, isActive })
      });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json()) as { news?: NewsReel; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save news reel.");
        return;
      }
      setMessage(data.news?.message ?? message);
      setIsActive(data.news?.isActive !== false);
      setUpdatedAt(data.news?.updatedAt ?? null);
      setNotice("News reel updated.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm font-semibold text-green-900/60">Loading news reel...</p>;

  return (
    <form onSubmit={save} className="max-w-2xl rounded-lg border border-green-900/10 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">News Reel</p>
          <p className="mt-1 text-sm font-semibold text-green-900/60">This updates the scrolling banner across the app without a redeploy.</p>
        </div>
        <label className="flex items-center gap-2 rounded-md bg-green-950/5 px-3 py-2 text-sm font-black text-green-950">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>
      </div>

      <textarea
        value={message}
        onChange={(event) => {
          setMessage(event.target.value.slice(0, 180));
          setNotice("");
          setError("");
        }}
        rows={3}
        maxLength={180}
        className="mt-5 w-full rounded-md border border-green-900/20 px-4 py-3 text-sm font-bold text-green-950 outline-none focus:border-pitch focus:ring-2 focus:ring-green-700/20"
        placeholder="Enter today's headline"
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold text-green-900/50">
        <span>{updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString("en-GB")}` : "Not yet updated"}</span>
        <span>{message.length}/180</span>
      </div>

      <div className="news-reel mt-4 rounded-md border border-green-900/10 bg-pitch text-white">
        <div className="news-reel-track">
          <NewsReelPreviewGroup message={message || "News reel preview"} />
          <NewsReelPreviewGroup message={message || "News reel preview"} ariaHidden />
        </div>
      </div>

      {notice ? <p className="mt-4 rounded-md bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={!message.trim() || saving}
          className="rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save News Reel"}
        </button>
        <button
          type="button"
          onClick={load}
          className="rounded-md bg-green-950/8 px-5 py-3 font-black text-green-950 hover:bg-green-950/15"
        >
          Reset
        </button>
      </div>
    </form>
  );
}

function NewsReelPreviewGroup({ message, ariaHidden = false }: { message: string; ariaHidden?: boolean }) {
  return (
    <div className="news-reel-group" aria-hidden={ariaHidden}>
      {Array.from({ length: 10 }).map((_, index) => (
        <span key={index} className="news-reel-item">{message}</span>
      ))}
    </div>
  );
}

function ActivityReviewTab({ onForbidden }: { onForbidden: () => void }) {
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/activity-logs", { credentials: "include" });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json()) as { logs: ActivityLogRow[] };
      setLogs(data.logs ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function removeLog(logId: number, reason: string) {
    const res = await fetch("/api/admin/activity-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ logId, reason })
    });
    if (res.status === 403) { onForbidden(); return; }
    await load();
  }

  if (loading) return <p className="text-sm font-semibold text-green-900/60">Loading activity logs...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Recent Activity Submissions</p>
        <button onClick={load} className="rounded-md bg-green-950/8 px-3 py-1.5 text-xs font-black text-green-950 hover:bg-green-950/15">Refresh</button>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm font-semibold text-green-900/60">No activity logs found.</p>
      ) : (
        logs.map((log) => <ActivityLogCard key={log.id} log={log} onRemove={removeLog} />)
      )}
    </div>
  );
}

function ActivityLogCard({ log, onRemove }: { log: ActivityLogRow; onRemove: (logId: number, reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const activity = activityDefinitions[log.activity_type] ?? activityDefinitions.walk;
  const amount = log.activity_amount ?? log.distance_km;
  const unit = log.activity_unit ?? "km";
  const awards = log.awards.map((award) => playerMap.get(award.player_id)?.name ?? `Player #${award.player_id}`);

  async function submitRemoval() {
    if (!reason.trim() || log.voided_at || busy) return;
    setBusy(true);
    try {
      await onRemove(log.id, reason.trim());
      setReason("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`rounded-lg border p-4 text-sm shadow-sm ${log.voided_at ? "border-slate-200 bg-slate-50 opacity-75" : "border-green-900/10 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-green-950">{log.username} · {activity.label}</p>
          <p className="mt-1 font-semibold text-green-900/65">
            {Number(amount).toFixed(unit === "km" ? 1 : 0)} {unit} · {log.distance_km.toFixed(2)} activity credits · {log.cards_earned} card{log.cards_earned === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs font-semibold text-green-900/45">{new Date(log.created_at).toLocaleString("en-GB")}</p>
        </div>
        {log.voided_at ? (
          <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-black text-slate-700">Removed</span>
        ) : (
          <span className="rounded-md bg-green-100 px-2 py-1 text-xs font-black text-green-800">Active</span>
        )}
      </div>

      {log.comment ? <p className="mt-3 rounded-md bg-green-950/5 p-3 font-semibold text-green-950">“{log.comment}”</p> : null}

      <div className="mt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">Cards Awarded</p>
        <p className="mt-1 text-xs font-semibold text-green-900/70">{awards.length > 0 ? awards.join(", ") : "No award detail stored for this log."}</p>
      </div>

      {log.voided_at ? (
        <p className="mt-3 rounded-md bg-slate-100 p-3 text-xs font-bold text-slate-700">Reason: {log.void_reason ?? "No reason recorded."}</p>
      ) : (
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for removing this false entry"
            className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-950 outline-none focus:ring-2 focus:ring-red-700/20"
          />
          <button
            onClick={submitRemoval}
            disabled={!reason.trim() || busy}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-black text-white hover:bg-red-800 disabled:opacity-40"
          >
            {busy ? "Removing..." : "Remove False Entry"}
          </button>
        </div>
      )}
    </article>
  );
}

function ResultsTab({ onForbidden }: { onForbidden: () => void }) {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [winner, setWinner] = useState<"home" | "away" | "draw" | "">("");
  const [status, setStatus] = useState<MatchStatus>("FINISHED");
  const [matchDate, setMatchDate] = useState(today);
  const [kickoffTime, setKickoffTime] = useState("20:00");
  const [submitting, setSubmitting] = useState(false);
  const [log, setLog] = useState<SubmittedResult[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeam || !awayTeam || homeTeam === awayTeam) return;

    const kickoffAt = `${matchDate}T${kickoffTime}:00.000Z`;
    const matchId = `manual-${matchDate}-${homeTeam.toLowerCase().replace(/\s+/g, "-")}-vs-${awayTeam.toLowerCase().replace(/\s+/g, "-")}`;
    const resolvedWinner =
      winner === "home" ? homeTeam : winner === "away" ? awayTeam : null;

    setSubmitting(true);
    try {
      const res = await fetch("/api/live/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ matchId, matchDate, kickoffAt, homeTeam, awayTeam, winner: resolvedWinner, status }),
      });

      if (res.status === 403) { onForbidden(); return; }

      const data = (await res.json()) as { ok?: boolean; error?: string };
      setLog((prev) => [{ matchId, homeTeam, awayTeam, winner: resolvedWinner, status, matchDate, ok: res.ok, error: data.error }, ...prev]);
      if (res.ok) setWinner("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[480px_1fr]">
      <form onSubmit={handleSubmit} className="rounded-lg border border-green-900/10 bg-white p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Home Team"><TeamSelect value={homeTeam} onChange={setHomeTeam} exclude={awayTeam} /></Field>
          <Field label="Away Team"><TeamSelect value={awayTeam} onChange={setAwayTeam} exclude={homeTeam} /></Field>
        </div>

        <Field label="Result">
          <div className="grid grid-cols-3 gap-2">
            {(["home", "draw", "away"] as const).map((opt) => (
              <button key={opt} type="button" onClick={() => setWinner(opt)}
                className={`rounded-md px-3 py-2 text-sm font-black transition-colors ${winner === opt ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}>
                {opt === "home" ? homeTeam || "Home" : opt === "away" ? awayTeam || "Away" : "Draw"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Status">
          <div className="grid grid-cols-3 gap-2">
            {(["SCHEDULED", "LIVE", "FINISHED"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={`rounded-md px-3 py-2 text-sm font-black transition-colors ${status === s ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}>
                {s}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Match Date">
            <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)}
              className="w-full rounded-md border border-green-900/20 bg-white px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
          <Field label="Kickoff (UTC)">
            <input type="time" value={kickoffTime} onChange={(e) => setKickoffTime(e.target.value)}
              className="w-full rounded-md border border-green-900/20 bg-white px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
        </div>

        <button type="submit" disabled={submitting || !homeTeam || !awayTeam || homeTeam === awayTeam}
          className="w-full rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800 disabled:opacity-40">
          {submitting ? "Saving…" : "Save Result"}
        </button>
      </form>

      <div className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Submission Log</p>
        {log.length === 0 ? (
          <p className="text-sm font-semibold text-green-900/60">No results submitted this session.</p>
        ) : (
          log.map((entry, i) => (
            <div key={i} className={`rounded-lg border p-4 text-sm font-semibold ${entry.ok ? "border-green-200 bg-green-50 text-green-950" : "border-red-200 bg-red-50 text-red-950"}`}>
              <p className="font-black">{entry.homeTeam} vs {entry.awayTeam} — {entry.matchDate}</p>
              <p className="mt-1">Winner: {entry.winner ?? "None"} · Status: {entry.status}</p>
              {entry.error ? <p className="mt-1 text-red-700">{entry.error}</p> : null}
              <p className="mt-1 text-xs opacity-60">{entry.matchId}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GoalScorersTab({ onForbidden }: { onForbidden: () => void }) {
  const [goals, setGoals] = useState<GoalScorerRow[]>([]);
  const [assists, setAssists] = useState<GoalScorerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState<"goal" | "assist">("goal");
  const [filter, setFilter] = useState<"all" | "pending" | "matched" | "ignored">("pending");
  const [addMatchId, setAddMatchId] = useState("");
  const [addScorerName, setAddScorerName] = useState("");
  const [addCount, setAddCount] = useState(1);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/goal-scorers", { credentials: "include" });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json()) as { goalScorers: GoalScorerRow[]; assistScorers: GoalScorerRow[] };
      setGoals(data.goalScorers ?? []);
      setAssists(data.assistScorers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function resolve(id: number, playerId: number | null) {
    await fetch("/api/admin/goal-scorers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "resolve", eventType, id, playerId }),
    });
    await load();
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!addMatchId || !addScorerName) return;
    setAdding(true);
    try {
      await fetch("/api/admin/goal-scorers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "add", eventType, matchId: addMatchId, scorerName: addScorerName, count: addCount }),
      });
      setAddScorerName("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  const active = eventType === "goal" ? goals : assists;
  const filtered = active.filter((s) => filter === "all" || s.status === filter);
  const pendingGoals = goals.filter((s) => s.status === "pending").length;
  const pendingAssists = assists.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Event type toggle */}
      <div className="flex gap-2">
        {(["goal", "assist"] as const).map((t) => (
          <button key={t} onClick={() => setEventType(t)}
            className={`rounded-md px-4 py-2 text-sm font-black transition-colors ${eventType === t ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}>
            {t === "goal" ? `Goals${pendingGoals > 0 ? ` (${pendingGoals} pending)` : ""}` : `Assists${pendingAssists > 0 ? ` (${pendingAssists} pending)` : ""}`}
          </button>
        ))}
      </div>

      {/* Add manual entry */}
      <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-green-900/60">Add {eventType === "goal" ? "Goal Scorer" : "Assist"} Manually</p>
        <form onSubmit={addManual} className="flex flex-wrap gap-3">
          <input value={addMatchId} onChange={(e) => setAddMatchId(e.target.value)} placeholder="Match ID (e.g. football-data-123)"
            className="flex-1 min-w-48 rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <input value={addScorerName} onChange={(e) => setAddScorerName(e.target.value)} placeholder="Player name (e.g. K. Mbappé)"
            className="flex-1 min-w-48 rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <input type="number" min={1} max={10} value={addCount} onChange={(e) => setAddCount(Number(e.target.value))}
            title={eventType === "goal" ? "Goals scored" : "Assists"}
            className="w-16 rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <button type="submit" disabled={adding || !addMatchId || !addScorerName}
            className="rounded-md bg-green-950 px-4 py-2 text-sm font-black text-white hover:bg-green-800 disabled:opacity-40">
            {adding ? "Adding…" : "Add & Fuzzy Match"}
          </button>
        </form>
      </div>

      {/* Filter + list */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex gap-2">
            {(["all", "pending", "matched", "ignored"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${filter === f ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={load} className="ml-auto rounded-md bg-green-950/8 px-3 py-1.5 text-xs font-black text-green-950 hover:bg-green-950/15">Refresh</button>
        </div>

        {loading ? (
          <p className="text-sm font-semibold text-green-900/60">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm font-semibold text-green-900/60">No records in this filter.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((scorer) => (
              <GoalScorerCard key={scorer.id} scorer={scorer} eventType={eventType} onResolve={resolve} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalScorerCard({ scorer, eventType, onResolve }: { scorer: GoalScorerRow; eventType: "goal" | "assist"; onResolve: (id: number, playerId: number | null) => void }) {
  const [playerIdInput, setPlayerIdInput] = useState(scorer.player_id?.toString() ?? "");

  const statusColour =
    scorer.status === "matched" ? "border-green-200 bg-green-50"
    : scorer.status === "ignored" ? "border-slate-200 bg-slate-50"
    : "border-amber-200 bg-amber-50";

  return (
    <div className={`rounded-lg border p-4 text-sm ${statusColour}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-green-950">{scorer.scorer_name_raw}</p>
          <p className="mt-0.5 text-xs font-semibold text-green-900/60">
            {scorer.home_team ?? "?"} vs {scorer.away_team ?? "?"} · {scorer.match_date ?? scorer.match_id}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-green-900/40">
            Status: {scorer.status} · Source: {scorer.source} · {eventType === "goal" ? `Goals: ${scorer.goal_count}` : `Assists: ${scorer.goal_count}`}
            {scorer.player_id != null ? ` · Player ID: ${scorer.player_id}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={playerIdInput}
            onChange={(e) => setPlayerIdInput(e.target.value)}
            placeholder="Player ID"
            className="w-24 rounded-md border border-green-900/20 bg-white px-2 py-1.5 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800"
          />
          <button
            onClick={() => onResolve(scorer.id, playerIdInput ? Number(playerIdInput) : null)}
            className="rounded-md bg-green-950 px-3 py-1.5 text-xs font-black text-white hover:bg-green-800"
          >
            Match
          </button>
          <button
            onClick={() => onResolve(scorer.id, null)}
            className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-300"
          >
            Ignore
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wide text-green-900/60">{label}</label>
      {children}
    </div>
  );
}

function TeamSelect({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-green-900/20 bg-white px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required>
      <option value="">Select team…</option>
      {WC_TEAMS.filter((t) => t !== exclude).map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}

function teamIdFromNation(nation: string) {
  return nation
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function signedAdjustment(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
