"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function getUserKey() {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem("brewnote_user_key");
  if (existing) return existing;

  const newKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `u_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  window.localStorage.setItem("brewnote_user_key", newKey);
  return newKey;
}

export function useBarCount() {
  const userKey = useMemo(() => getUserKey(), []);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      if (!url || !anon) throw new Error("Missing Supabase env vars");

      const res = await fetch(
        `${url}/rest/v1/inventory?select=id&user_key=eq.${encodeURIComponent(userKey)}`,
        {
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
            "Content-Type": "application/json",
            "x-user-key": userKey,
          },
          cache: "no-store",
        }
      );

      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const rows = text ? (JSON.parse(text) as Array<{ id: string }>) : [];
      setCount(rows.length);
    } catch {
      // badge er nice-to-have, så vi fejler “silent”
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [userKey]);

  useEffect(() => {
    load();

    const onChange = () => load();
    window.addEventListener("brewnote_bar_changed", onChange);
    return () => window.removeEventListener("brewnote_bar_changed", onChange);
  }, [load]);

  return { count, loading, refresh: load };
}
