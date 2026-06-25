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

type ActivityMultiplierSetting = {
  multiplier: number;
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
  const [tab, setTab] = useState<"results" | "goalscorers" | "activity" | "boost" | "news" | "players" | "ratings" | "settle" | "monitor">("results");
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
        {(["results", "monitor", "goalscorers", "activity", "boost", "news", "players", "ratings", "settle"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-black transition-colors ${tab === t ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}
          >
            {t === "results" ? "Match Results" : t === "monitor" ? "Match Monitor" : t === "goalscorers" ? "Goal Scorers" : t === "activity" ? "Activity Review" : t === "boost" ? "Activity Boost" : t === "news" ? "News Reel" : t === "players" ? "Late Call-Ups" : t === "ratings" ? "Viral Ratings" : "Live Settle"}
          </button>
        ))}
      </div>

      {tab === "results" && <ResultsTab onForbidden={() => setForbidden(true)} />}
      {tab === "monitor" && <MatchMonitorTab onForbidden={() => setForbidden(true)} />}
      {tab === "goalscorers" && <GoalScorersTab onForbidden={() => setForbidden(true)} />}
      {tab === "activity" && <ActivityReviewTab onForbidden={() => setForbidden(true)} />}
      {tab === "boost" && <ActivityBoostTab onForbidden={() => setForbidden(true)} />}
      {tab === "news" && <NewsReelTab onForbidden={() => setForbidden(true)} />}
      {tab === "players" && <LateCallupsTab onForbidden={() => setForbidden(true)} />}
      {tab === "ratings" && <ViralRatingsTab onForbidden={() => setForbidden(true)} />}
      {tab === "settle" && <LiveSettleTab onForbidden={() => setForbidden(true)} />}
    </div>
  );
}

function ActivityBoostTab({ onForbidden }: { onForbidden: () => void }) {
  const [multiplier, setMultiplier] = useState(1.25);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/activity-config", { credentials: "include" })
      .then(async (response) => {
        if (response.status === 403) { onForbidden(); return null; }
        const payload = (await response.json()) as { setting?: ActivityMultiplierSetting; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Could not load activity boost.");
        return payload.setting;
      })
      .then((setting) => {
        if (!setting) return;
        setMultiplier(setting.multiplier);
        setUpdatedAt(setting.updatedAt);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [onForbidden]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/activity-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ multiplier })
      });
      if (response.status === 403) { onForbidden(); return; }
      const payload = (await response.json()) as { setting?: ActivityMultiplierSetting; error?: string };
      if (!response.ok || !payload.setting) throw new Error(payload.error ?? "Could not save activity boost.");
      setMultiplier(payload.setting.multiplier);
      setUpdatedAt(payload.setting.updatedAt);
      setNotice(`Activity rewards are now ${payload.setting.multiplier}x.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save activity boost.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm font-semibold text-green-900/60">Loading activity boost...</p>;

  return (
    <form onSubmit={save} className="max-w-2xl rounded-lg border border-green-900/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Activity Reward Multiplier</p>
      <p className="mt-2 text-sm font-semibold text-green-900/65">Applies immediately to new activity logs. Existing activity awards are not recalculated.</p>

      <div className="mt-6 rounded-xl bg-green-950 p-5 text-white">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-widest text-white/55">Current boost</p><p className="mt-1 text-4xl font-black">{multiplier.toFixed(2)}x</p></div>
          <label className="text-right text-xs font-bold text-white/70">Exact value<input aria-label="Exact activity multiplier" type="number" min="0.25" max="10" step="0.05" value={multiplier} onChange={(event) => setMultiplier(Number(event.target.value))} className="mt-1 block w-28 rounded-md border border-white/20 bg-white px-3 py-2 text-right text-base font-black text-green-950" /></label>
        </div>
        <input aria-label="Activity multiplier" type="range" min="0.25" max="4" step="0.05" value={Math.min(multiplier, 4)} onChange={(event) => setMultiplier(Number(event.target.value))} className="mt-6 w-full accent-amber-400" />
        <div className="mt-1 flex justify-between text-[10px] font-black text-white/45"><span>0.25x</span><span>1x</span><span>2x</span><span>3x</span><span>4x</span></div>
      </div>

      <div className="mt-4 rounded-md bg-amber-50 p-4 text-sm font-bold text-amber-950">Example: 4 activity credits at {multiplier.toFixed(2)}x contribute {(4 * multiplier).toFixed(2)} credits toward sticker pulls.</div>
      {updatedAt ? <p className="mt-3 text-xs font-bold text-green-900/45">Last changed {new Date(updatedAt).toLocaleString("en-GB")}</p> : null}
      {notice ? <p className="mt-4 rounded-md bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      <button type="submit" disabled={saving || !Number.isFinite(multiplier) || multiplier < 0.25 || multiplier > 10} className="mt-5 rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800 disabled:opacity-40">{saving ? "Saving..." : "Save Activity Boost"}</button>
    </form>
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
  const [diagUser, setDiagUser] = useState("");
  const [diagPlayerId, setDiagPlayerId] = useState("1125");
  const [diagMatchDate, setDiagMatchDate] = useState("2026-06-23");
  const [diagLines, setDiagLines] = useState<string[] | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  async function runDiagnostic() {
    if (diagBusy || !diagUser.trim()) return;
    setDiagBusy(true);
    setDiagLines(null);
    try {
      const res = await fetch(`/api/admin/boost-diagnostic?username=${encodeURIComponent(diagUser.trim())}`, { credentials: "include" });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json().catch(() => ({}))) as { lines?: string[]; error?: string };
      setDiagLines(data.lines ?? [data.error ?? "No result."]);
    } finally {
      setDiagBusy(false);
    }
  }

  async function repairBoost() {
    if (diagBusy || !diagUser.trim() || !diagPlayerId.trim()) return;
    setDiagBusy(true);
    setDiagLines(null);
    try {
      const res = await fetch("/api/admin/boost-diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: diagUser.trim(),
          playerId: Number(diagPlayerId),
          matchDate: diagMatchDate.trim() || undefined
        })
      });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json().catch(() => ({}))) as { lines?: string[]; repaired?: number; error?: string };
      setDiagLines(data.lines ? [`Repaired rows: ${data.repaired ?? 0}`, ...data.lines] : [data.error ?? "No result."]);
    } finally {
      setDiagBusy(false);
    }
  }

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
        reconciledBoosts?: number;
        providerStatus?: { status: string; message: string };
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not settle live awards.");
        return;
      }
      setNotice(`Settled ${data.usersSettled ?? 0} users. Reconciled ${data.reconciledBoosts ?? 0} boost rows. Fixture sync: ${data.providerStatus?.status ?? "unknown"} - ${data.providerStatus?.message ?? "No provider message."}`);
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
        reconciledBoosts?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not resync goals.");
        return;
      }
      const more = (data.remaining ?? 0) > 0 ? ` Run again to fetch the remaining ${data.remaining}.` : "";
      setNotice(`${data.message ?? ""} Re-settled ${data.usersSettled ?? 0} users and reconciled ${data.reconciledBoosts ?? 0} boost rows.${more}`);
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

      <div className="mt-6 border-t border-green-900/10 pt-5">
        <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Boost Diagnostic</p>
        <p className="mt-2 text-sm font-semibold text-green-900/65">Enter a username to see, per locked squad, which matched goals/assists fell in the window, whether the player was in the locked XI, and whether a boost was applied.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={diagUser} onChange={(e) => setDiagUser(e.target.value)} placeholder="username (e.g. magseyclarke)"
            className="min-w-48 flex-1 rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <button onClick={runDiagnostic} disabled={diagBusy || !diagUser.trim()}
            className="rounded-md bg-green-950 px-5 py-2 font-black text-white hover:bg-green-800 disabled:opacity-40">
            {diagBusy ? "Checking…" : "Check"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={diagPlayerId} onChange={(e) => setDiagPlayerId(e.target.value)} placeholder="player id"
            className="w-28 rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <input value={diagMatchDate} onChange={(e) => setDiagMatchDate(e.target.value)} placeholder="match date"
            className="w-40 rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <button onClick={repairBoost} disabled={diagBusy || !diagUser.trim() || !diagPlayerId.trim()}
            className="rounded-md bg-amber-600 px-5 py-2 font-black text-white hover:bg-amber-700 disabled:opacity-40">
            Audit & Repair Player Boost
          </button>
        </div>
        {diagLines ? (
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-green-950/5 p-3 text-xs font-semibold text-green-950">{diagLines.join("\n")}</pre>
        ) : null}
      </div>
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
            <input type="number" min={1} max={199} step={1} value={form.rating} onChange={(e) => update("rating", e.target.value)}
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

type BoostLogRow = { username: string; playerName: string; eventType: "goal" | "assist"; amount: number; match: string; createdAt: string };
type Contributor = { id: number; playerId: number | null; name: string; count: number; status: string };
type AdminGame = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  kickoffAt: string;
  winner: string | null;
  confirmed: boolean;
  scorers: Contributor[];
  assists: Contributor[];
};

function GoalScorersTab({ onForbidden }: { onForbidden: () => void }) {
  const [games, setGames] = useState<AdminGame[]>([]);
  const [boostLog, setBoostLog] = useState<BoostLogRow[]>([]);
  const [playerPool, setPlayerPool] = useState<Player[]>(basePlayerPool);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showReviewed, setShowReviewed] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/goal-scorers", { credentials: "include" });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json()) as { games?: AdminGame[]; boostLog?: BoostLogRow[] };
      setGames(data.games ?? []);
      setBoostLog(data.boostLog ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadPlayerPool().then(setPlayerPool);
  }, []);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/goal-scorers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      if (res.status === 403) { onForbidden(); return; }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const queue = [...games].filter((g) => !g.confirmed).sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  const reviewed = games.filter((g) => g.confirmed);
  const pos = Math.min(reviewIndex, Math.max(0, queue.length - 1));
  const current = queue[pos];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-green-900/10 bg-green-950/5 p-4">
        <p className="text-sm font-bold text-green-950">
          {loading ? "Loading completed games…" : queue.length === 0 ? "✓ All completed games reviewed." : `${queue.length} completed game${queue.length === 1 ? "" : "s"} to review.`}
        </p>
        <p className="mt-1 text-xs font-semibold text-green-900/55">For each finished game, add the goalscorers and assists (KMXI-pool players only), then confirm to move to the next.</p>
      </div>

      {current ? (
        <GameReview
          key={current.matchId}
          game={current}
          position={pos + 1}
          total={queue.length}
          playerPool={playerPool}
          busy={busy}
          onAdd={(eventType, playerId, count) => post({ action: "addByPlayer", eventType, matchId: current.matchId, playerId, count })}
          onRemove={(eventType, id) => post({ action: "remove", eventType, id })}
          onConfirm={() => post({ action: "confirm", matchId: current.matchId })}
          onSkip={() => setReviewIndex((i) => i + 1)}
        />
      ) : null}

      {reviewed.length > 0 ? (
        <div className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
          <button onClick={() => setShowReviewed((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold uppercase tracking-wide text-green-900/60">
            <span>Reviewed games ({reviewed.length})</span>
            <span>{showReviewed ? "Hide ▲" : "Show ▼"}</span>
          </button>
          {showReviewed ? (
            <div className="mt-3 space-y-2">
              {reviewed.map((g) => (
                <div key={g.matchId} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-green-950/5 px-3 py-2 text-sm">
                  <span className="font-bold text-green-950">{g.matchDate} · {g.homeTeam} v {g.awayTeam}</span>
                  <span className="text-xs font-semibold text-green-900/55">
                    {g.scorers.reduce((s, c) => s + c.count, 0)} goals · {g.assists.reduce((s, c) => s + c.count, 0)} assists
                  </span>
                  <button onClick={() => post({ action: "reopen", matchId: g.matchId })} className="rounded-md bg-green-950/8 px-3 py-1 text-xs font-black text-green-950 hover:bg-green-950/15">
                    Reopen
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-green-900/60">Boosts Applied</p>
        {boostLog.length === 0 ? (
          <p className="text-sm font-semibold text-green-900/60">No boosts applied yet.</p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {boostLog.map((b, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-md bg-green-950/5 px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate font-bold text-green-950">
                  {b.eventType === "goal" ? "⚽" : "🅰️"} <span className="font-black">{b.playerName}</span> → {b.username}
                </span>
                <span className="shrink-0 text-xs font-semibold text-green-900/55">{b.match}</span>
                <span className={`shrink-0 w-10 text-right font-black ${b.amount > 0 ? "text-green-700" : "text-red-600"}`}>{b.amount > 0 ? `+${b.amount}` : b.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GameReview({ game, position, total, playerPool, busy, onAdd, onRemove, onConfirm, onSkip }: {
  game: AdminGame;
  position: number;
  total: number;
  playerPool: Player[];
  busy: boolean;
  onAdd: (eventType: "goal" | "assist", playerId: number, count: number) => void;
  onRemove: (eventType: "goal" | "assist", id: number) => void;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-green-900/10 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">Reviewing {position} of {total}</p>
          <p className="mt-1 text-lg font-black text-green-950">{game.homeTeam} v {game.awayTeam}</p>
          <p className="text-xs font-semibold text-green-900/55">{game.matchDate}{game.winner ? ` · ${game.winner} won` : " · draw"}</p>
        </div>
        <button onClick={onSkip} disabled={busy} className="rounded-md bg-green-950/8 px-3 py-1.5 text-xs font-black text-green-950 hover:bg-green-950/15 disabled:opacity-40">Skip for now</button>
      </div>

      <ContributorSection label="Goalscorers" eventType="goal" items={game.scorers} playerPool={playerPool} busy={busy} onAdd={onAdd} onRemove={onRemove} />
      <ContributorSection label="Assists" eventType="assist" items={game.assists} playerPool={playerPool} busy={busy} onAdd={onAdd} onRemove={onRemove} />

      <button onClick={onConfirm} disabled={busy} className="mt-4 w-full rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800 disabled:opacity-40">
        Confirm — scorers complete for this game
      </button>
    </div>
  );
}

function ContributorSection({ label, eventType, items, playerPool, busy, onAdd, onRemove }: {
  label: string;
  eventType: "goal" | "assist";
  items: Contributor[];
  playerPool: Player[];
  busy: boolean;
  onAdd: (eventType: "goal" | "assist", playerId: number, count: number) => void;
  onRemove: (eventType: "goal" | "assist", id: number) => void;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-green-900/55">{label}</p>
      <div className="space-y-1.5">
        {items.length === 0 ? <p className="text-sm font-semibold text-green-900/45">None added yet.</p> : null}
        {items.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-green-950/5 px-3 py-1.5 text-sm">
            <span className="min-w-0 truncate font-bold text-green-950">
              {c.name}{c.count > 1 ? <span className="ml-1 rounded bg-green-950/10 px-1.5 text-xs font-black">×{c.count}</span> : null}
              {c.status === "pending" ? <span className="ml-1 rounded bg-amber-100 px-1.5 text-[10px] font-black uppercase text-amber-800">unmatched</span> : null}
            </span>
            <button onClick={() => onRemove(eventType, c.id)} disabled={busy} className="shrink-0 rounded-md bg-green-950/8 px-2 py-1 text-xs font-black text-green-900 hover:bg-red-100 hover:text-red-700 disabled:opacity-40">Remove</button>
          </div>
        ))}
      </div>
      <ScorerAdder playerPool={playerPool} busy={busy} eventLabel={eventType === "goal" ? "goals" : "assists"} onAdd={(playerId, count) => onAdd(eventType, playerId, count)} />
    </div>
  );
}

function ScorerAdder({ playerPool, busy, eventLabel, onAdd }: { playerPool: Player[]; busy: boolean; eventLabel: string; onAdd: (playerId: number, count: number) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Player | null>(null);
  const [count, setCount] = useState(1);

  const matches = query.trim().length >= 2
    ? playerPool.filter((p) => `${p.name} ${p.nation}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="mt-2 rounded-md border border-dashed border-green-900/20 p-2">
      {selected ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-green-950">{selected.name} <span className="font-semibold text-green-900/55">· {selected.rating} {selected.rarity} · {selected.nation}</span></span>
          <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} title={eventLabel}
            className="w-16 rounded-md border border-green-900/20 px-2 py-1.5 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <button
            onClick={() => { onAdd(selected.id, Math.max(1, Math.min(10, count))); setSelected(null); setQuery(""); setCount(1); }}
            disabled={busy}
            className="rounded-md bg-green-950 px-3 py-1.5 text-sm font-black text-white hover:bg-green-800 disabled:opacity-40"
          >
            Add
          </button>
          <button onClick={() => { setSelected(null); setQuery(""); }} className="text-xs font-black uppercase text-green-900/50 hover:text-green-950">Cancel</button>
        </div>
      ) : (
        <>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Add a ${eventLabel === "goals" ? "goalscorer" : "assist"} — search player…`}
            className="w-full rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          {matches.length > 0 ? (
            <div className="mt-1 space-y-1">
              {matches.map((p) => (
                <button key={p.id} type="button" onClick={() => setSelected(p)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm font-bold text-green-950 hover:bg-green-950/5">
                  <span>{p.name}</span>
                  <span className="text-xs font-semibold text-green-900/55">{p.rating} {p.rarity} · {p.nation}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
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
