"use client";

import { useRouter } from "next/navigation";

export function NavActions({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className={`rounded-md font-semibold text-green-950 hover:bg-green-100 ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
    >
      Logout
    </button>
  );
}
