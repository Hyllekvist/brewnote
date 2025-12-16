"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./BarPage.module.css";

type Item = {
  id: string;
  user_key: string;
  product_slug: string;
  created_at: string;
};

function productHref(slug: string) {
  const s = slug.toLowerCase();
  const isTea = s.startsWith("tea-") || s.includes("tea") || s.includes("matcha");
  return isTea ? `/teas/${slug}` : `/coffees/${slug}`;
}

function prettyName(slug: string) {
  return slug.replaceAll("-", " ");
}

function getUserKey() {
  const existing = window.localStorage.getItem("brewnote_user_key");
  if (existing) return existing;

  const newKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `u_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  window.localStorage.setItem("brewnote_user_key", newKey);
  return newKey;
}

export function BarClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userKey = useMemo(() => (typeof window === "undefined" ? "server" : getUserKey()), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!url || !anon) throw new Error("Missing Supabase env vars");

        const res = await fetch(
          `${url}/rest/v1/inventory?select=id,user_key,product_slug,created_at&user_key=eq.${encodeURIComponent(
            userKey
          )}&order=created_at.desc`,
          {
            headers: {
              apikey: anon,
              Authorization: `Bearer ${anon}`,
            },
            cache: "no-store",
          }
        );

        const text = await res.text();
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

        setItems(JSON.parse(text) as Item[]);
      } catch (e: any) {
        setError(e?.message || "Kunne ikke hente Bar");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userKey]);

  if (loading) return <div className={styles.state}>Indlæser…</div>;

  if (error)
    return (
      <div className={styles.errorBox}>
        <div className={styles.errorTitle}>Fejl</div>
        <div className={styles.errorText}>{error}</div>
      </div>
    );

  if (!items.length)
    return (
      <div className={styles.emptyBox}>
        <div className={styles.emptyTitle}>Din Bar er tom</div>
        <div className={styles.emptyText}>
          Gå ind på en kaffe eller te og tryk <strong>“Tilføj til Bar”</strong>.
        </div>
        <div className={styles.emptyCtaRow}>
          <Link className={styles.emptyLink} href="/coffees/espresso-blend">
            Åbn en kaffe →
          </Link>
        </div>
      </div>
    );

  return (
    <div className={styles.grid}>
      {items.map((it) => (
        <Link key={it.id} href={productHref(it.product_slug)} className={styles.card}>
          <div className={styles.cardMeta}>Tilføjet</div>
          <div className={styles.cardTitle}>{prettyName(it.product_slug)}</div>
          <div className={styles.cardHint}>Åbn produkt →</div>
        </Link>
      ))}
    </div>
  );
}
