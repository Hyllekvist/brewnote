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

function productType(slug: string): "tea" | "coffee" {
  const s = slug.toLowerCase();
  const isTea = s.startsWith("tea-") || s.includes("tea") || s.includes("matcha");
  return isTea ? "tea" : "coffee";
}

function productHref(slug: string) {
  return productType(slug) === "tea" ? `/teas/${slug}` : `/coffees/${slug}`;
}

function brewHref(slug: string) {
  const type = productType(slug);
  return `/brew?type=${type}&slug=${encodeURIComponent(slug)}`;
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
  const [busyId, setBusyId] = useState<string | null>(null);

  const userKey = useMemo(
    () => (typeof window === "undefined" ? "server" : getUserKey()),
    []
  );

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
          headers: { apikey: anon, Authorization: `Bearer ${anon}` },
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  async function removeItem(id: string) {
    setBusyId(id);
    setError(null);

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      if (!url || !anon) throw new Error("Missing Supabase env vars");

      // optimistic UI
      const prev = items;
      setItems((x) => x.filter((i) => i.id !== id));

      const res = await fetch(
        `${url}/rest/v1/inventory?id=eq.${encodeURIComponent(
          id
        )}&user_key=eq.${encodeURIComponent(userKey)}`,
        {
          method: "DELETE",
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
            Prefer: "return=minimal",
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        // rollback
        setItems(prev);
        throw new Error(text || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      setError(e?.message || "Kunne ikke fjerne item");
    } finally {
      setBusyId(null);
    }
  }

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
        <div key={it.id} className={styles.card}>
          <div className={styles.cardMeta}>I din bar</div>
          <div className={styles.cardTitle}>{prettyName(it.product_slug)}</div>

          <div className={styles.actions}>
            <Link className={styles.primaryBtn} href={brewHref(it.product_slug)}>
              Bryg nu
            </Link>

            <Link className={styles.ghostBtn} href={productHref(it.product_slug)}>
              Åbn produkt
            </Link>

            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => removeItem(it.id)}
              disabled={busyId === it.id}
              aria-busy={busyId === it.id}
            >
              {busyId === it.id ? "Fjerner…" : "Fjern"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
