"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const original = window.fetch;

    window.fetch = async (...args) => {
      const response = await original(...args);
      if (response.status === 401 && pathname !== "/login") {
        router.push("/login");
      }
      return response;
    };

    return () => {
      window.fetch = original;
    };
  }, [pathname, router]);

  return null;
}
