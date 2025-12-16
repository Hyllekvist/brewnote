"use client"; 

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

  const aliveRef = useRef(true);
  const inFlightRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const loadNow = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      if (!url || !anon) throw new Error("Missing Supabase env vars");

      const res = await fetch(
        `${url}/rest/v1/inventory?select=id&user_key=eq.${encodeURIComponent(
          userKey
        )}`,
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
      if (aliveRef.current) setCount(rows.length);
    } catch {
      // badge er nice-to-have -> fail silent
      if (aliveRef.current) setCount(0);
    } finally {
      if (aliveRef.current) setLoading(false);
      inFlightRef.current = false;
    }
  }, [userKey]);

  const refresh = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      loadNow();
    }, 120);
  }, [loadNow]);

  useEffect(() => {
    aliveRef.current = true;
    loadNow();

    const onAnyChange = () => refresh();

    // ✅ centraliseret: alle steder kan bare dispatch'e disse
    window.addEventListener("brewnote_bar_changed", onAnyChange);
    window.addEventListener("brewnote_brew_logged", onAnyChange);

    return () => {
      aliveRef.current = false;
      window.removeEventListener("brewnote_bar_changed", onAnyChange);
      window.removeEventListener("brewnote_brew_logged", onAnyChange);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [loadNow, refresh]);

  return { count, loading, refresh };
}
