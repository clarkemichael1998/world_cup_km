"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { PageTitle } from "@/components/PageTitle";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not log in.");
      return;
    }
    window.localStorage.removeItem("km-footy-state-v1");
    window.sessionStorage.removeItem("km-footy-last-rewards-v1");
    router.push("/squad");
    router.refresh();
  }

  return (
    <div>
      <PageTitle title="Login" subtitle="Create or reopen your KMXI account. Password must be at least 8 characters." />
      <form onSubmit={submit} className="premium-card max-w-md rounded-2xl p-6">
        <label className="block text-sm font-bold uppercase tracking-wide text-green-900/70" htmlFor="username">
          Username
          <input id="username" className="mt-2 w-full rounded-md border border-green-900/20 px-4 py-3 text-base font-bold" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="mt-4 block text-sm font-bold uppercase tracking-wide text-green-900/70" htmlFor="password">
          Password
          <input id="password" className="mt-2 w-full rounded-md border border-green-900/20 px-4 py-3 text-base font-bold" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          ⚠️ There is no password recovery. If you forget your password, your account cannot be accessed. Write it down somewhere safe.
        </p>
        {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}
        <Button type="submit" variant="primary" size="lg" className="mt-5" disabled={busy}>
          {busy ? "Working..." : "Continue"}
        </Button>
      </form>
    </div>
  );
}
