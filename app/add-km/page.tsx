"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { addRewardPlayers, calculateRewards, getKmMultiplier, getRandomPlayerByRarity } from "@/lib/rewardEngine";
import { loadUserStateAsync, saveRevealPlayers, saveUserState } from "@/lib/storage";
import type { UserState } from "@/lib/types";

const MAX_KM_PER_LOG = 50;
const MAX_LOGS_PER_DAY = 3;

export default function AddKmPage() {
  const router = useRouter();
  const [distance, setDistance] = useState("");
  const [state, setState] = useState<UserState | null>(null);
  const [error, setError] = useState("");
  const [liveCredits, setLiveCredits] = useState(0);
  const [logsToday, setLogsToday] = useState<number | null>(null);
  const multiplier = getKmMultiplier();
  const numericDistance = Number(distance);
  const preview =
    state && Number.isFinite(numericDistance) && numericDistance > 0 && numericDistance <= MAX_KM_PER_LOG
      ? calculateRewards(numericDistance, state.kmBalance, multiplier)
      : null;
  const logsRemaining = logsToday === null ? null : MAX_LOGS_PER_DAY - logsToday;
  const limitReached = logsRemaining !== null && logsRemaining <= 0;

  useEffect(() => {
    loadUserStateAsync().then(setState);
    fetch("/api/live")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        setLiveCredits(payload.live.rewardCredits ?? 0);
      })
      .catch(() => {});
    fetch("/api/km-log/today")
      .then((r) => r.json())
      .then((d) => setLogsToday(d.count ?? 0))
      .catch(() => setLogsToday(0));
  }, []);

  async function submitDistance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;

    const value = Number(distance);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a distance greater than 0.");
      return;
    }
    if (value > MAX_KM_PER_LOG) {
      setError(`Maximum ${MAX_KM_PER_LOG}km per log.`);
      return;
    }
    if (limitReached) {
      setError(`You've reached the limit of ${MAX_LOGS_PER_DAY} logs today. Come back tomorrow!`);
      return;
    }

    const { rewards, newBalance } = calculateRewards(value, state.kmBalance, multiplier);
    const bonusCredits = await consumeLiveCredits();
    const rewardPlayers = Array.from({ length: rewards + bonusCredits }, () => getRandomPlayerByRarity());
    const updated = addRewardPlayers(
      {
        ...state,
        totalKm: Number((state.totalKm + value).toFixed(2)),
        kmBalance: newBalance
      },
      rewardPlayers
    );

    saveUserState(updated);
    saveRevealPlayers(rewardPlayers);

    const logResponse = await fetch("/api/km-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ distanceKm: value, cardsEarned: rewardPlayers.length })
    });

    if (!logResponse.ok) {
      const payload = await logResponse.json().catch(() => ({}));
      setError(payload.error ?? "Could not log distance.");
      return;
    }

    router.push("/reveal");
  }

  return (
    <div>
      <PageTitle title="Add KM" subtitle="Every whole kilometre creates one player reward. Any leftover distance carries forward." />

      <form onSubmit={submitDistance} className="max-w-xl rounded-lg border border-green-900/10 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <label className="block text-sm font-bold uppercase tracking-wide text-green-900/70" htmlFor="distance">
            Distance travelled
          </label>
          {logsRemaining !== null && (
            <span className={`text-xs font-black uppercase tracking-wide ${limitReached ? "text-red-600" : "text-green-700"}`}>
              {limitReached ? "Limit reached" : `${logsRemaining} log${logsRemaining === 1 ? "" : "s"} left today`}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <input
            id="distance"
            className="min-w-0 flex-1 rounded-md border border-green-900/20 px-4 py-3 text-lg font-bold outline-none focus:border-pitch focus:ring-2 focus:ring-green-700/20"
            inputMode="decimal"
            placeholder="3.4"
            value={distance}
            disabled={limitReached}
            onChange={(event) => {
              setDistance(event.target.value);
              setError("");
            }}
          />
          <button
            className="rounded-md bg-boot px-5 py-3 font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={limitReached}
          >
            Log
          </button>
        </div>
        {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}
        {limitReached ? (
          <p className="mt-3 rounded-md bg-red-50 p-4 text-sm font-bold text-red-800">
            You&apos;ve logged {MAX_LOGS_PER_DAY} times today — the daily maximum. Come back tomorrow!
          </p>
        ) : (
          <p className="mt-3 text-xs font-semibold text-green-900/50">Max {MAX_KM_PER_LOG}km per log · {MAX_LOGS_PER_DAY} logs per day · <span className="text-green-700 font-black">{multiplier}× cards/km this week</span></p>
        )}
        <div className="mt-3 rounded-md bg-green-50 p-4 text-sm font-semibold text-green-950">
          Current carry-over balance: {state ? state.kmBalance.toFixed(2) : "..."}km
        </div>
        {liveCredits > 0 ? <div className="mt-3 rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-950">Live bonuses waiting: {liveCredits} extra reward credit{liveCredits === 1 ? "" : "s"}.</div> : null}
        {preview ? (
          <div className="mt-3 rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-950">
            This will earn {preview.rewards} card{preview.rewards === 1 ? "" : "s"} and leave {preview.newBalance.toFixed(2)}km banked.
          </div>
        ) : null}
      </form>
    </div>
  );
}

async function consumeLiveCredits() {
  try {
    const response = await fetch("/api/live/consume-credits", { method: "POST" });
    const payload = await response.json();
    return Number(payload.credits ?? 0);
  } catch {
    return 0;
  }
}
