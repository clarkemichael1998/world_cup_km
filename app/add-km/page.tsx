"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { PageTitle } from "@/components/PageTitle";
import {
  activityDefinitions,
  calculateActivityCredits,
  calculateRewards,
  getKmMultiplier
} from "@/lib/rewardEngine";
import { loadUserStateAsync } from "@/lib/storage";
import type { ActivityType, UserState } from "@/lib/types";

const MAX_LOGS_PER_DAY = 3;
const activityOptions = Object.entries(activityDefinitions) as Array<[ActivityType, (typeof activityDefinitions)[ActivityType]]>;
const pendingActivityKey = "km-footy-pending-activity-v1";

export default function AddKmPage() {
  const router = useRouter();
  const [activityType, setActivityType] = useState<ActivityType>("walk");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<UserState | null>(null);
  const [error, setError] = useState("");
  const [liveCredits, setLiveCredits] = useState(0);
  const [logsToday, setLogsToday] = useState<number | null>(null);
  const multiplier = getKmMultiplier();
  const activity = activityDefinitions[activityType];
  const numericAmount = Number(amount);
  const activityCredits = Number.isFinite(numericAmount) && numericAmount > 0 ? calculateActivityCredits(activityType, numericAmount) : 0;
  const preview =
    state && Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount <= activity.maxPerLog
      ? calculateRewards(activityCredits, state.kmBalance, multiplier)
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

  async function submitActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError(`Enter ${activity.unit === "km" ? "a distance" : "a duration"} greater than 0.`);
      return;
    }
    if (value > activity.maxPerLog) {
      setError(`Maximum ${activity.maxPerLog} ${activity.unit} per ${activity.label.toLowerCase()} log.`);
      return;
    }
    if (limitReached) {
      setError(`You've reached the limit of ${MAX_LOGS_PER_DAY} logs today. Come back tomorrow!`);
      return;
    }

    window.sessionStorage.setItem(pendingActivityKey, JSON.stringify({ activityType, amount: value, comment: comment.trim().slice(0, 240) }));
    router.push("/add-km/confirm");
  }

  return (
    <div>
      <PageTitle title="Add Activity" subtitle="Walks, runs, strength workouts, and other sessions all convert into reward credits." />

      <form onSubmit={submitActivity} className="max-w-xl rounded-lg border border-green-900/10 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <label className="block text-sm font-bold uppercase tracking-wide text-green-900/70" htmlFor="activity-amount">
            Activity
          </label>
          {logsRemaining !== null && (
            <span className={`text-xs font-black uppercase tracking-wide ${limitReached ? "text-red-600" : "text-green-700"}`}>
              {limitReached ? "Limit reached" : `${logsRemaining} log${logsRemaining === 1 ? "" : "s"} left today`}
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
          <select
            className="rounded-md border border-green-900/20 bg-white px-3 py-3 text-sm font-black text-green-950 outline-none focus:border-pitch focus:ring-2 focus:ring-green-700/20"
            value={activityType}
            disabled={limitReached}
            onChange={(event) => {
              setActivityType(event.target.value as ActivityType);
              setError("");
            }}
          >
            {activityOptions.map(([value, definition]) => (
              <option key={value} value={value}>
                {definition.label}
              </option>
            ))}
          </select>
          <input
            id="activity-amount"
            className="min-w-0 flex-1 rounded-md border border-green-900/20 px-4 py-3 text-lg font-bold outline-none focus:border-pitch focus:ring-2 focus:ring-green-700/20"
            inputMode="decimal"
            placeholder={activity.unit === "km" ? "3.4" : "45"}
            value={amount}
            disabled={limitReached}
            onChange={(event) => {
              setAmount(event.target.value);
              setError("");
            }}
          />
          <Button variant="danger" size="lg" type="submit" disabled={limitReached}>
            Review
          </Button>
        </div>
        <label className="mt-4 block text-sm font-bold uppercase tracking-wide text-green-900/70" htmlFor="activity-comment">
          Optional note for the group
          <textarea
            id="activity-comment"
            className="mt-2 min-h-24 w-full resize-none rounded-md border border-green-900/20 px-4 py-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-pitch focus:ring-2 focus:ring-green-700/20"
            maxLength={240}
            placeholder="Route, workout, effort, or proof context..."
            value={comment}
            disabled={limitReached}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <p className="mt-1 text-right text-xs font-bold text-green-900/50">{comment.length}/240</p>
        <p className="mt-2 text-xs font-bold text-green-900/60">
          Enter {activity.unit}. {activity.label} converts at {activity.creditsPerUnit < 1 ? `${Math.round(1 / activity.creditsPerUnit)} ${activity.unit} = 1 credit` : "1 km = 1 credit"}.
        </p>
        {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}
        {limitReached ? (
          <p className="mt-3 rounded-md bg-red-50 p-4 text-sm font-bold text-red-800">
            You&apos;ve logged {MAX_LOGS_PER_DAY} times today. Come back tomorrow!
          </p>
        ) : (
          <p className="mt-3 text-xs font-semibold text-green-900/50">
            Max {activity.maxPerLog} {activity.unit} per log · {MAX_LOGS_PER_DAY} logs per day ·{" "}
            <span className="font-black text-green-700">{multiplier}x stickers/activity credit this week</span>
          </p>
        )}
        <div className="mt-3 rounded-md bg-green-50 p-4 text-sm font-semibold text-green-950">
          Current carry-over balance: {state ? state.kmBalance.toFixed(2) : "..."} activity credits
        </div>
        {liveCredits > 0 ? (
          <div className="mt-3 rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-950">
            Live bonuses waiting: {liveCredits} extra reward credit{liveCredits === 1 ? "" : "s"}.
          </div>
        ) : null}
        {preview ? (
          <div className="mt-3 rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-950">
            {activity.label} gives {activityCredits.toFixed(2)} activity credit{activityCredits === 1 ? "" : "s"}. This will earn {preview.rewards} sticker{preview.rewards === 1 ? "" : "s"} and leave {preview.newBalance.toFixed(2)} credits banked.
          </div>
        ) : null}
      </form>
    </div>
  );
}
