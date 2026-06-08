import { NextResponse } from "next/server";
import { createChatMessage, getAllPlayers, getCurrentUser, getKmFeed, getKmLogsToday, getPersistedUserState, logActivityWithServerAwards } from "@/lib/server/db";
import { activityDefinitions, calculateActivityCredits, calculateRewards, getKmMultiplier, getRandomPlayerFromPool, isActivityType } from "@/lib/rewardEngine";

const MAX_LOGS_PER_DAY = 3;
const WC_FINAL_LOCKOUT = new Date("2026-07-19T18:00:00Z");

export async function GET() {
  return NextResponse.json({ feed: getKmFeed() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  if (new Date() >= WC_FINAL_LOCKOUT) {
    return NextResponse.json({ error: "Activity logging is locked — the World Cup Final has kicked off!" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    activityType?: unknown;
    amount?: number;
    distanceKm?: number;
    comment?: string;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid entry." }, { status: 400 });
  }

  const activityType = isActivityType(body.activityType) ? body.activityType : "walk";
  const activity = activityDefinitions[activityType];
  const amount = typeof body.amount === "number" ? body.amount : body.distanceKm;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid entry." }, { status: 400 });
  }

  if (amount > activity.maxPerLog) {
    return NextResponse.json({ error: `Maximum ${activity.maxPerLog} ${activity.unit} per ${activity.label.toLowerCase()} log.` }, { status: 400 });
  }

  const logsToday = getKmLogsToday(user.id);
  if (logsToday >= MAX_LOGS_PER_DAY) {
    return NextResponse.json({ error: `You've reached the limit of ${MAX_LOGS_PER_DAY} logs per day. Come back tomorrow!` }, { status: 400 });
  }

  const multiplier = getKmMultiplier();
  const activityCredits = calculateActivityCredits(activityType, amount);
  const currentState = getPersistedUserState(user.id);
  const preview = calculateRewards(activityCredits, currentState.kmBalance, multiplier);
  const bonusCredits = Math.max(0, Math.floor(user.rewardCredits));
  const cardsEarned = preview.rewards + bonusCredits;
  const allPlayers = getAllPlayers();
  const awardedPlayers = Array.from({ length: cardsEarned }, () => getRandomPlayerFromPool(allPlayers));
  const awardedPlayerIds = awardedPlayers.map((player) => player.id);
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 240) : "";
  const rewardCreditValue = Number((activityCredits * multiplier).toFixed(2));
  const activityCardsEarned = preview.rewards;
  const chatMessageId = createChatMessage(
    user.id,
    buildActivityChatMessage({
      username: user.username,
      activityLabel: activity.label,
      amount,
      unit: activity.unit,
      activityCredits,
      activityCardsEarned,
      comment
    })
  );
  const persisted = logActivityWithServerAwards({
    userId: user.id,
    activityCredits,
    cardsEarned,
    activityType,
    activityAmount: amount,
    activityUnit: activity.unit,
    comment,
    rewardCreditValue,
    balanceBefore: currentState.kmBalance,
    balanceAfter: preview.newBalance,
    awardedPlayerIds,
    chatMessageId
  });
  const nextState = getPersistedUserState(user.id);
  return NextResponse.json({
    ok: true,
    logsRemaining: MAX_LOGS_PER_DAY - logsToday - 1,
    multiplier,
    bonusCredits,
    playerIds: awardedPlayerIds,
    players: awardedPlayerIds.map((id) => allPlayers.find((player) => player.id === id)).filter(Boolean),
    state: { ...nextState, totalKm: persisted.totalKm, kmBalance: persisted.kmBalance }
  });
}

function buildActivityChatMessage({
  username,
  activityLabel,
  amount,
  unit,
  activityCredits,
  activityCardsEarned,
  comment
}: {
  username: string;
  activityLabel: string;
  amount: number;
  unit: string;
  activityCredits: number;
  activityCardsEarned: number;
  comment: string;
}) {
  const amountText = `${Number(amount).toFixed(unit === "km" ? 1 : 0)} ${unit}`;
  const cardText = `${activityCardsEarned} card${activityCardsEarned === 1 ? "" : "s"}`;
  return [
    `${username} logged ${activityLabel}: ${amountText}, earning ${activityCredits.toFixed(2)} activity credits and ${cardText}.`,
    comment ? `“${comment}”` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}
