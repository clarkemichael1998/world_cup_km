"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/Button";
import { ChatFeed } from "@/components/ChatFeed";

const WC_FINAL = new Date("2026-07-19T18:00:00Z");

function useCountdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = WC_FINAL.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs };
}

export default function Home() {
  const [rewardCredits, setRewardCredits] = useState<number | null>(null);
  const [canSetNews, setCanSetNews] = useState(false);
  const [wonMatchday, setWonMatchday] = useState<string | null>(null);
  const [newsMessage, setNewsMessage] = useState("");
  const [newsNotice, setNewsNotice] = useState("");
  const [newsBusy, setNewsBusy] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState(1);
  const [redeeming, setRedeeming] = useState(false);
  const router = useRouter();
  const countdown = useCountdown();

  useEffect(() => {
    fetch("/api/credits", { credentials: "include" })
      .then((r) => r.json())
      .then((p) => setRewardCredits(p.credits ?? 0))
      .catch(() => {});
    fetch("/api/news", { credentials: "include" })
      .then((r) => r.json())
      .then((p) => {
        setCanSetNews(Boolean(p.canSetNews) && Boolean(p.wonMatchday));
        setWonMatchday(p.wonMatchday ?? null);
        setNewsMessage(p.news?.message ?? "");
      })
      .catch(() => {});
  }, []);

  async function submitNews() {
    if (newsBusy || !newsMessage.trim()) return;
    setNewsBusy(true);
    setNewsNotice("");
    try {
      const response = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: newsMessage })
      });
      const payload = await response.json();
      setNewsNotice(response.ok ? "Headline live — it's on the reel now." : payload.error ?? "Could not set the news.");
    } finally {
      setNewsBusy(false);
    }
  }

  async function openPack() {
    if (redeeming || !rewardCredits || rewardCredits < redeemAmount) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: redeemAmount })
      });
      if (res.ok) {
        setRewardCredits((c) => (c ?? 0) - redeemAmount);
        router.push("/reveal");
      }
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BrandLogo />
        {countdown ? (
          <div className="flex items-end gap-3 rounded-lg border border-green-900/20 bg-pitch px-4 py-2.5 text-white shadow-sm">
            <CountUnit value={countdown.days} label="days" />
            <CountUnit value={countdown.hours} label="hrs" />
            <CountUnit value={countdown.mins} label="min" />
            <CountUnit value={countdown.secs} label="sec" />
          </div>
        ) : (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-black text-amber-900">Final kicked off — logging locked.</p>
        )}
      </div>

      {canSetNews ? (
        <section className="rounded-lg border border-amber-400 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-amber-800">👑 Matchday Champion{wonMatchday ? ` — ${wonMatchday}` : ""}</p>
          <p className="mt-1 text-sm font-bold text-amber-900">You won yesterday&apos;s head-to-head. Your prize: set today&apos;s news reel.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950"
              maxLength={180}
              placeholder="Write today's headline..."
              value={newsMessage}
              onChange={(event) => setNewsMessage(event.target.value)}
            />
            <Button variant="accent" onClick={submitNews} disabled={newsBusy || !newsMessage.trim()}>
              {newsBusy ? "Publishing..." : "Publish"}
            </Button>
          </div>
          {newsNotice ? <p className="mt-2 text-xs font-black text-amber-800">{newsNotice}</p> : null}
        </section>
      ) : null}

      {rewardCredits !== null && rewardCredits > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-amber-800">Pack Credits</p>
            <p className="mt-0.5 text-xl font-black text-amber-900">{rewardCredits} <span className="text-sm font-semibold text-amber-700">to open</span></p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setRedeemAmount((a) => Math.max(1, a - 1))} disabled={redeemAmount <= 1}
                className="rounded-md bg-amber-200 px-2 py-1 text-sm font-black text-amber-900 hover:bg-amber-300 disabled:opacity-40">−</button>
              <span className="w-8 text-center text-lg font-black text-amber-900">{redeemAmount}</span>
              <button onClick={() => setRedeemAmount((a) => Math.min(rewardCredits, 20, a + 1))} disabled={redeemAmount >= Math.min(rewardCredits, 20)}
                className="rounded-md bg-amber-200 px-2 py-1 text-sm font-black text-amber-900 hover:bg-amber-300 disabled:opacity-40">+</button>
            </div>
            <Button variant="accent" onClick={openPack} disabled={redeeming}>
              {redeeming ? "Opening…" : `Open ${redeemAmount}`}
            </Button>
          </div>
        </section>
      ) : null}

      <ChatFeed />
    </div>
  );
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black leading-none tabular-nums">{String(value).padStart(2, "0")}</p>
      <p className="text-[9px] font-black uppercase tracking-wide text-green-200/70">{label}</p>
    </div>
  );
}
