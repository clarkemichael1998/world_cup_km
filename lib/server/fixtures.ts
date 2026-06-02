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

    // Extract goal scorers from finished matches
    for (const match of payload.matches ?? []) {
      if (match.status === "FINISHED" && match.goals && match.goals.length > 0) {
        const matchId = `football-data-${match.id}`;
        const scorerNames = match.goals.map((g) => g.scorer?.name).filter((n): n is string => Boolean(n));
        const assistNames = match.goals.map((g) => g.assist?.name).filter((n): n is string => Boolean(n));
        if (scorerNames.length > 0) processGoalScorers(matchId, scorerNames);
        if (assistNames.length > 0) processAssistScorers(matchId, assistNames);
      }
    }
    recordProviderRun(provider, "ok", `Synced ${fixtures.length} World Cup fixtures.`);
    return getProviderStatus();
  } catch (error) {
    recordProviderRun(provider, "fallback", `Provider fetch failed; kept verified cached/manual results. ${error instanceof Error ? error.message : ""}`.trim());
    return getProviderStatus();
  }
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
