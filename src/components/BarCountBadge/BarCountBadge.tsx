"use client"; 

import { useEffect, useMemo, useState } from "react";
import styles from "./BarCountBadge.module.css";

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

async function fetchBarCount(userKey: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("Missing Supabase env vars");

  // head=true + count=exact => kun count, ingen rows
  const res = await fetch(
    `${url}/rest/v1/inventory?user_key=eq.${encodeURIComponent(userKey)}`,
    {
      method: "HEAD",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Prefer: "count=exact",
        "x-user-key": userKey,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return null;

  const countHeader = res.headers.get("content-range"); // fx "0-0/12"
  if (!countHeader) return null;
  const total = Number(countHeader.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

export default function BarCountBadge() {
  const userKey = useMemo(() => getUserKey(), []);
  const [count, setCount] = useState<number | null>(null);

  async function refresh() {
    const c = await fetchBarCount(userKey);
    if (typeof c === "number") setCount(c);
  }

  useEffect(() => {
    refresh();

    const onChange = () => refresh();
    window.addEventListener("brewnote_bar_changed", onChange);
    window.addEventListener("storage", onChange); // hvis flere tabs

    return () => {
      window.removeEventListener("brewnote_bar_changed", onChange);
      window.removeEventListener("storage", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  if (!count || count <= 0) return null;
  return <span className={styles.badge}>{count}</span>;
}