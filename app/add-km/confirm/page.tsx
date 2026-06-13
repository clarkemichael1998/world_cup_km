"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonClasses } from "@/components/Button";
import { PageTitle } from "@/components/PageTitle";
import {
  activityDefinitions,
  calculateActivityCredits,
  calculateRewards,
  DEFAULT_ACTIVITY_MULTIPLIER,
  isActivityType
} from "@/lib/rewardEngine";
import { cacheUserState, loadUserStateAsync, saveRevealPlayers } from "@/lib/storage";
import type { ActivityType, Player, UserState } from "@/lib/types";

const pendingActivityKey = "km-footy-pending-activity-v1";

type PendingActivity = {
  activityType: ActivityType;
  amount: number;
  comment: string;
};

export default function ConfirmActivityPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingActivity | null>(null);
  const [state, setState] = useState<UserState | null>(null);
  const [liveCredits, setLiveCredits] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [multiplier, setMultiplier] = useState(DEFAULT_ACTIVITY_MULTIPLIER);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(pendingActivityKey);
    if (!saved) {
      router.replace("/add-km");
      return;
    }
    try {
      const parsed = JSON.parse(saved) as Partial<PendingActivity>;
      if (!isActivityType(parsed.activityType) || typeof parsed.amount !== "number" || parsed.amount <= 0) {
        router.replace("/add-km");
        return;
      }
      setPending({ activityType: parsed.activityType, amount: parsed.amount, comment: String(parsed.comment ?? "").slice(0, 240) });
    } catch {
      router.replace("/add-km");
    }
    loadUserStateAsync().then(setState);
    fetch("/api/live")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        setLiveCredits(payload.live.rewardCredits ?? 0);
      })
      .catch(() => {});
    fetch("/api/activity-config")
      .then((response) => response.json())
      .then((payload) => setMultiplier(Number(payload.multiplier) || DEFAULT_ACTIVITY_MULTIPLIER))
      .catch(() => {});
  }, [router]);

  if (!pending || !state) {
    return (
      <div>
        <PageTitle title="Review Activity" subtitle="Loading your pending submission..." />
      </div>
    );
  }

  const currentState: UserState = state;
  const currentPending: PendingActivity = pending;
  const activity = activityDefinitions[currentPending.activityType];
  const activityCredits = calculateActivityCredits(currentPending.activityType, currentPending.amount);
  const rewardCreditValue = Number((activityCredits * multiplier).toFixed(2));
  const preview = calculateRewards(activityCredits, currentState.kmBalance, multiplier);
  const totalCards = preview.rewards + liveCredits;
  const amountText = `${currentPending.amount.toFixed(activity.unit === "km" ? 1 : 0)} ${activity.unit}`;

  async function submitFinal() {
    if (submitting) return;
    setSubmitting(true);
    setError("");

    const logResponse = await fetch("/api/km-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        activityType: currentPending.activityType,
        amount: currentPending.amount,
        comment: currentPending.comment
      })
    });

    if (!logResponse.ok) {
      const payload = await logResponse.json().catch(() => ({}));
      setSubmitting(false);
      setError(payload.error ?? "Could not submit activity.");
      return;
    }

    const payload = (await logResponse.json()) as { players?: Player[]; state?: UserState };
    if (payload.state) cacheUserState(payload.state);
    saveRevealPlayers(payload.players ?? [], false);
    window.sessionStorage.removeItem(pendingActivityKey);
    router.push("/reveal");
  }

  return (
    <div>
      <PageTitle title="Review Activity" subtitle="Check this carefully before submitting it to the group." />

      <section className="max-w-2xl rounded-lg border border-green-900/10 bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Summary label="Activity" value={activity.label} />
          <Summary label="Amount" value={amountText} />
          <Summary label="Activity Credits" value={activityCredits.toFixed(2)} />
          <Summary label="Cards Earned" value={String(totalCards)} />
          <Summary label="Carry-over After" value={`${preview.newBalance.toFixed(2)} credits`} />
          <Summary label="Multiplier" value={`${multiplier}x`} />
        </div>

        {currentPending.comment ? (
          <div className="mt-4 rounded-md bg-green-950/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">Comment</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-green-950">“{currentPending.comment}”</p>
          </div>
        ) : null}

        <div className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
          <p className="font-black">This submission is final.</p>
          <p className="mt-1">
            Your activity log will be visible to the group and posted in chat. Other players can react and may question logs that look unrealistic. Please only submit real activity.
          </p>
        </div>

        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/add-km" className={buttonClasses("ghost", "lg")}>
            Back to edit
          </Link>
          <Button variant="danger" size="lg" disabled={submitting} onClick={submitFinal}>
            {submitting ? "Submitting..." : "Submit Activity"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-green-950/5 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">{label}</p>
      <p className="mt-1 text-lg font-black text-green-950">{value}</p>
    </div>
  );
}
