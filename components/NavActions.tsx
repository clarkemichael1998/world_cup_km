"use client";

import { useRouter } from "next/navigation";

export function NavActions() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="rounded-md px-3 py-2 text-sm font-semibold text-green-950 hover:bg-green-100"
    >
      Logout
    </button>
  );
}
