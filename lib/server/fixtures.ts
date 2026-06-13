import { getDb } from "./db";
import { processGoalScorers, processAssistScorers } from "./goalScorers";

type FixtureResult = {
  matchId: string;
  matchDate: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  winner: string | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  source: string;
  verified: boolean;
};

export type ProviderStatus = {
  provider: string;
  status: "ok" | "fallback" | "error";
  message: string;
  checkedAt: string;
};

const footballDataTeamNames: Record<string, string> = {
  USA: "United States",
  "Korea Republic": "South Korea",
  "Côte d'Ivoire": "Ivory Coast",
  "Czechia": "Czech Republic",
  "Congo DR": "DR Congo"
};

export async function syncFixtureResults() {
  if (process.env.FOOTBALL_DATA_API_KEY) {
    return syncFootballData();
  }

  recordProviderRun("manual-cache", "fallback", "No FOOTBALL_DATA_API_KEY configured; using verified cached/manual fixture results only.");
  return getProviderStatus();
}

export function upsertManualFixture(result: Omit<FixtureResult, "source" | "verified">) {
  upsertFixtures([{ ...result, source: "manual", verified: true }]);
  recordProviderRun("manual", "ok", `Imported manual result ${result.matchId}.`);
}

export function getProviderStatus(): ProviderStatus {
  const row = getDb()
    .prepare("SELECT provider, status, message, checked_at FROM fixture_provider_runs ORDER BY checked_at DESC, id DESC LIMIT 1")
    .get() as { provider: string; status: ProviderStatus["status"]; message: string | null; checked_at: string } | undefined;

  return {
    provider: row?.provider ?? "manual-cache",
    status: row?.status ?? "fallback",
    message: row?.message ?? "No provider has run yet; using verified cached/manual fixture results only.",
    checkedAt: row?.checked_at ?? new Date().toISOString()
  };
}

async function syncFootballData() {
  const provider = "football-data.org";
  const url = "https://api.football-data.org/v4/competitions/WC/matches?dateFrom=2026-06-11&dateTo=2026-07-19";

  try {
    const response = await fetch(url, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY ?? "" },
      cache: "no-store"
    });

    if (!response.ok) {
      recordProviderRun(provider, "fallback", `Provider returned ${response.status}; kept verified cached/manual results.`);
      return getProviderStatus();
    }

    const payload = (await response.json()) as {
      matches?: Array<{
        id: number;
        utcDate: string;
        status: string;
        homeTeam?: { name?: string };
        awayTeam?: { name?: string };
        score?: { winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null };
        goals?: Array<{ scorer?: { name?: string }; assist?: { name?: string }; minute?: number }>;
      }>;
    };

    const fixtures = (payload.matches ?? []).map((match): FixtureResult => {
      const homeTeam = normalizeTeam(match.homeTeam?.name ?? "Unknown");
      const awayTeam = normalizeTeam(match.awayTeam?.name ?? "Unknown");
      const winner = match.score?.winner === "HOME_TEAM" ? homeTeam : match.score?.winner === "AWAY_TEAM" ? awayTeam : null;
      return {
        matchId: `football-data-${match.id}`,
        matchDate: match.utcDate.slice(0, 10),
        kickoffAt: match.utcDate,
        homeTeam,
        awayTeam,
        winner,
        status: match.status === "FINISHED" ? "FINISHED" : match.status === "IN_PLAY" || match.status === "PAUSED" ? "LIVE" : "SCHEDULED",
        source: provider,
        verified: match.status === "FINISHED" && Boolean(winner)
      };
    });

    upsertFixtures(fixtures);

    // The competition list endpoint omits the goals[] array — scorer/assist
    // detail only comes from the per-match endpoint. Pull details for finished
    // matches we haven't synced yet (capped per run for rate limits).
    const goalStats = await syncGoalsForFinishedMatches(payload.matches ?? []);

    recordProviderRun(
      provider,
      "ok",
      `Synced ${fixtures.length} fixtures. Goals: checked ${goalStats.matchesChecked} finished match${goalStats.matchesChecked === 1 ? "" : "es"}, found ${goalStats.goalsFound} scorer event${goalStats.goalsFound === 1 ? "" : "s"}.`
    );
    return getProviderStatus();
  } catch (error) {
    recordProviderRun(provider, "fallback", `Provider fetch failed; kept verified cached/manual results. ${error instanceof Error ? error.message : ""}`.trim());
    return getProviderStatus();
  }
}

const MAX_DETAIL_FETCHES_PER_RUN = 6;

async function syncGoalsForFinishedMatches(
  matches: Array<{ id: number; status: string; goals?: Array<{ scorer?: { name?: string }; assist?: { name?: string } }> }>,
  cap: number = MAX_DETAIL_FETCHES_PER_RUN
): Promise<{ matchesChecked: number; goalsFound: number; remaining: number }> {
  const db = getDb();
  const finishedIds = matches.filter((m) => m.status === "FINISHED").map((m) => `football-data-${m.id}`);
  if (finishedIds.length === 0) return { matchesChecked: 0, goalsFound: 0, remaining: 0 };

  // Only fetch detail for finished matches we haven't already synced.
  const placeholders = finishedIds.map(() => "?").join(",");
  const unsyncedRows = db
    .prepare(`SELECT match_id FROM fixture_results WHERE goals_synced = 0 AND match_id IN (${placeholders})`)
    .all(...finishedIds) as Array<{ match_id: string }>;
  const unsynced = new Set(unsyncedRows.map((r) => r.match_id));

  let matchesChecked = 0;
  let goalsFound = 0;
  const markSynced = db.prepare("UPDATE fixture_results SET goals_synced = 1 WHERE match_id = ?");

  for (const match of matches) {
    if (matchesChecked >= cap) break;
    const matchId = `football-data-${match.id}`;
    if (!unsynced.has(matchId)) continue;

    // Goals may already be on the match object (paid tiers); otherwise fetch detail.
    let goals = match.goals;
    if (!goals) {
      try {
        const response = await fetch(`https://api.football-data.org/v4/matches/${match.id}`, {
          headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY ?? "" },
          cache: "no-store"
        });
        if (!response.ok) continue; // leave unsynced; retry next run
        const detail = (await response.json()) as { goals?: Array<{ scorer?: { name?: string }; assist?: { name?: string } }> };
        goals = detail.goals ?? [];
      } catch {
        continue;
      }
    }

    matchesChecked++;
    const scorerNames = goals.map((g) => g.scorer?.name).filter((n): n is string => Boolean(n));
    const assistNames = goals.map((g) => g.assist?.name).filter((n): n is string => Boolean(n));
    goalsFound += scorerNames.length;
    if (scorerNames.length > 0) processGoalScorers(matchId, scorerNames);
    if (assistNames.length > 0) processAssistScorers(matchId, assistNames);
    markSynced.run(matchId);
  }

  const remaining = (db
    .prepare(`SELECT COUNT(*) AS c FROM fixture_results WHERE goals_synced = 0 AND match_id IN (${placeholders})`)
    .get(...finishedIds) as { c: number }).c;

  return { matchesChecked, goalsFound, remaining };
}

// Admin-triggered: pull scorer detail for finished matches with a higher cap so
// past days catch up. With force=true it clears the synced flag first so matches
// that previously returned no goals are re-checked. Reports the API breakdown so
// it's clear whether the provider is actually returning scorer data.
export async function resyncFinishedGoals(force = false): Promise<{
  ok: boolean;
  matchesChecked: number;
  goalsFound: number;
  apiHadGoals: number;
  remaining: number;
  message: string;
}> {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return { ok: false, matchesChecked: 0, goalsFound: 0, apiHadGoals: 0, remaining: 0, message: "No FOOTBALL_DATA_API_KEY configured — fixtures/goals come from cache/manual only." };
  }
  const url = "https://api.football-data.org/v4/competitions/WC/matches?dateFrom=2026-06-11&dateTo=2026-07-19";
  try {
    const response = await fetch(url, { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY }, cache: "no-store" });
    if (!response.ok) {
      return { ok: false, matchesChecked: 0, goalsFound: 0, apiHadGoals: 0, remaining: 0, message: `Provider returned HTTP ${response.status}.` };
    }
    const payload = (await response.json()) as { matches?: Array<{ id: number; status: string }> };
    const matches = payload.matches ?? [];
    const finished = matches.filter((m) => m.status === "FINISHED");

    if (matches.length === 0) {
      return { ok: true, matchesChecked: 0, goalsFound: 0, apiHadGoals: 0, remaining: 0, message: "API returned 0 World Cup matches for the window." };
    }
    if (finished.length === 0) {
      return { ok: true, matchesChecked: 0, goalsFound: 0, apiHadGoals: 0, remaining: 0, message: `API has ${matches.length} matches but 0 are FINISHED yet — nothing to pull.` };
    }

    const db = getDb();
    if (force) {
      const ids = finished.map((m) => `football-data-${m.id}`);
      const ph = ids.map(() => "?").join(",");
      db.prepare(`UPDATE fixture_results SET goals_synced = 0 WHERE match_id IN (${ph})`).run(...ids);
    }

    const stats = await syncGoalsForFinishedMatchesDiag(matches, 9);
    return {
      ok: true,
      matchesChecked: stats.matchesChecked,
      goalsFound: stats.goalsFound,
      apiHadGoals: stats.apiHadGoals,
      remaining: stats.remaining,
      message: `${finished.length} finished match${finished.length === 1 ? "" : "es"} in API. Checked ${stats.matchesChecked}; ${stats.apiHadGoals} returned goal data; matched ${stats.goalsFound} scorer event${stats.goalsFound === 1 ? "" : "s"}. ${stats.remaining} still to check.`
    };
  } catch (error) {
    return { ok: false, matchesChecked: 0, goalsFound: 0, apiHadGoals: 0, remaining: 0, message: error instanceof Error ? error.message : "Fetch failed." };
  }
}

// Like syncGoalsForFinishedMatches but also reports how many matches the API
// actually returned a non-empty goals array for (the key diagnostic).
async function syncGoalsForFinishedMatchesDiag(
  matches: Array<{ id: number; status: string; goals?: Array<{ scorer?: { name?: string }; assist?: { name?: string } }> }>,
  cap: number
): Promise<{ matchesChecked: number; goalsFound: number; apiHadGoals: number; remaining: number }> {
  const db = getDb();
  const finishedIds = matches.filter((m) => m.status === "FINISHED").map((m) => `football-data-${m.id}`);
  const ph = finishedIds.map(() => "?").join(",");
  const unsynced = new Set(
    (db.prepare(`SELECT match_id FROM fixture_results WHERE goals_synced = 0 AND match_id IN (${ph})`).all(...finishedIds) as Array<{ match_id: string }>).map((r) => r.match_id)
  );

  let matchesChecked = 0;
  let goalsFound = 0;
  let apiHadGoals = 0;
  const markSynced = db.prepare("UPDATE fixture_results SET goals_synced = 1 WHERE match_id = ?");

  for (const match of matches) {
    if (matchesChecked >= cap) break;
    const matchId = `football-data-${match.id}`;
    if (!unsynced.has(matchId)) continue;

    let goals = match.goals;
    if (!goals) {
      try {
        const response = await fetch(`https://api.football-data.org/v4/matches/${match.id}`, {
          headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY ?? "" },
          cache: "no-store"
        });
        if (!response.ok) continue;
        const detail = (await response.json()) as { goals?: Array<{ scorer?: { name?: string }; assist?: { name?: string } }> };
        goals = detail.goals ?? [];
      } catch {
        continue;
      }
    }

    matchesChecked++;
    if (goals.length > 0) apiHadGoals++;
    const scorerNames = goals.map((g) => g.scorer?.name).filter((n): n is string => Boolean(n));
    const assistNames = goals.map((g) => g.assist?.name).filter((n): n is string => Boolean(n));
    goalsFound += scorerNames.length;
    if (scorerNames.length > 0) processGoalScorers(matchId, scorerNames);
    if (assistNames.length > 0) processAssistScorers(matchId, assistNames);
    markSynced.run(matchId);
  }

  const remaining = (db.prepare(`SELECT COUNT(*) AS c FROM fixture_results WHERE goals_synced = 0 AND match_id IN (${ph})`).get(...finishedIds) as { c: number }).c;
  return { matchesChecked, goalsFound, apiHadGoals, remaining };
}

function upsertFixtures(fixtures: FixtureResult[]) {
  const statement = getDb().prepare(`
    INSERT INTO fixture_results (match_id, match_date, kickoff_at, home_team, away_team, winner, status, source, verified, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(match_id) DO UPDATE SET
      match_date = excluded.match_date,
      kickoff_at = excluded.kickoff_at,
      home_team = excluded.home_team,
      away_team = excluded.away_team,
      winner = excluded.winner,
      status = excluded.status,
      source = excluded.source,
      verified = excluded.verified,
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const fixture of fixtures) {
    statement.run(fixture.matchId, fixture.matchDate, fixture.kickoffAt, fixture.homeTeam, fixture.awayTeam, fixture.winner, fixture.status, fixture.source, fixture.verified ? 1 : 0);
  }
}

function recordProviderRun(provider: string, status: ProviderStatus["status"], message: string) {
  getDb().prepare("INSERT INTO fixture_provider_runs (provider, status, message) VALUES (?, ?, ?)").run(provider, status, message);
}

function normalizeTeam(name: string) {
  return footballDataTeamNames[name] ?? name;
}
