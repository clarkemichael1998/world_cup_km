"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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
    await migrateLocalState();
    router.push("/live");
    router.refresh();
  }

  return (
    <div>
      <PageTitle title="Login" subtitle="Create or reopen your KMXI account. Password must be at least 8 characters." />
      <form onSubmit={submit} className="max-w-md rounded-lg border border-green-900/10 bg-white p-6 shadow-sm">
        <label className="block text-sm font-bold uppercase tracking-wide text-green-900/70" htmlFor="username">
          Username
          <input id="username" className="mt-2 w-full rounded-md border border-green-900/20 px-4 py-3 text-base font-bold" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="mt-4 block text-sm font-bold uppercase tracking-wide text-green-900/70" htmlFor="password">
          Password
          <input id="password" className="mt-2 w-full rounded-md border border-green-900/20 px-4 py-3 text-base font-bold" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}
        <button className="mt-5 rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800" disabled={busy}>
          {busy ? "Working..." : "Continue"}
        </button>
      </form>
    </div>
  );
}

async function migrateLocalState() {
  const saved = window.localStorage.getItem("km-footy-state-v1");
  if (!saved) return;

  try {
    await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ state: JSON.parse(saved) })
    });
  } catch {}
}
