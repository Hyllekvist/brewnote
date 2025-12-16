"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./BarClient.module.css";

type Item = {
  id: string;
  user_key: string;
  product_slug: string;
  created_at: string;
};

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

function isTeaSlug(slug: string) {
  const s = slug.toLowerCase();
  return s.startsWith("tea-") || s.includes("tea") || s.includes("matcha");
}

function productHref(slug: string) {
  return isTeaSlug(slug) ? `/teas/${slug}` : `/coffees/${slug}`;
}

function brewHref(slug: string) {
  const type = isTeaSlug(slug) ? "tea" : "coffee";
  return `/brew?type=${type}&slug=${encodeURIComponent(slug)}`;
}

type FilterType = "all" | "coffee" | "tea";
type SortMode = "recent" | "az" | "za";

export default function BarClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // UI controls
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortMode>("recent");
  const [q, setQ] = useState("");

  const userKey = useMemo(() => getUserKey(), []);

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
            "Content-Type": "application/json",
            "x-user-key": userKey,
          },
          cache: "no-store",
        }
      );

      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

      setItems(text ? (JSON.parse(text) as Item[]) : []);
    } catch (e: any) {
      setError(e?.message || "Kunne ikke hente Bar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeItem(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);

    // optimistic UI
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== id));

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      if (!url || !anon) throw new Error("Missing Supabase env vars");

      const res = await fetch(
        `${url}/rest/v1/inventory?id=eq.${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
            "x-user-key": userKey,
          },
        }
      );

      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

      window.dispatchEvent(new Event("brewnote_bar_changed"));
    } catch (e: any) {
      setItems(prev); // rollback
      setError(e?.message || "Kunne ikke fjerne");
    } finally {
      setBusyId(null);
    }
  }

  // Derived list: filter + search + sort
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();

    let list = items.slice();

    // filter coffee/tea
    if (filter !== "all") {
      list = list.filter((it) => {
        const tea = isTeaSlug(it.product_slug);
        return filter === "tea" ? tea : !tea;
      });
    }

    // search (slug -> pretty name)
    if (query) {
      list = list.filter((it) =>
        it.product_slug.replaceAll("-", " ").toLowerCase().includes(query)
      );
    }

    // sort
    if (sort === "recent") {
      // already desc from API, but keep stable
      list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    } else if (sort === "az") {
      list.sort((a, b) =>
        a.product_slug.localeCompare(b.product_slug, "da", { sensitivity: "base" })
      );
    } else if (sort === "za") {
      list.sort((a, b) =>
        b.product_slug.localeCompare(a.product_slug, "da", { sensitivity: "base" })
      );
    }

    return list;
  }, [items, filter, sort, q]);

  if (loading) return <div className={styles.loading}>Indlæser…</div>;

  if (error)
    return (
      <div className={styles.errorCard}>
        <div className={styles.errorTitle}>Fejl</div>
        <div className={styles.errorBody}>{error}</div>
        <button className={styles.retry} onClick={load} type="button">
          Prøv igen
        </button>
      </div>
    );

  if (!items.length)
    return (
      <div className={styles.emptyCard}>
        <div className={styles.emptyTitle}>Din Bar er tom</div>
        <div className={styles.emptyBody}>
          Gå ind på en kaffe eller te og tryk <strong>“Tilføj til Bar”</strong>.
        </div>
        <div className={styles.emptyActions}>
          <Link className={styles.emptyLink} href="/coffees/espresso-blend">
            Åbn en kaffe →
          </Link>
        </div>
      </div>
    );

  return (
    <div>
      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <input
            className={styles.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søg i din bar…"
            aria-label="Søg i din bar"
          />
        </div>

        <div className={styles.pills} role="tablist" aria-label="Filter">
          <button
            type="button"
            className={filter === "all" ? styles.pillActive : styles.pill}
            onClick={() => setFilter("all")}
          >
            Alle
          </button>
          <button
            type="button"
            className={filter === "coffee" ? styles.pillActive : styles.pill}
            onClick={() => setFilter("coffee")}
          >
            Kaffe
          </button>
          <button
            type="button"
            className={filter === "tea" ? styles.pillActive : styles.pill}
            onClick={() => setFilter("tea")}
          >
            Te
          </button>
        </div>

        <div className={styles.sortRow}>
          <div className={styles.sortLabel}>Sorter</div>
          <select
            className={styles.select}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Sorter din bar"
          >
            <option value="recent">Senest tilføjet</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>

          <div className={styles.count}>
            {shown.length} / {items.length}
          </div>
        </div>
      </div>

      {/* List */}
      <div className={styles.grid}>
        {shown.map((it) => {
          const pretty = it.product_slug.replaceAll("-", " ");
          const tea = isTeaSlug(it.product_slug);

          return (
            <article key={it.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.kicker}>{tea ? "Te" : "Kaffe"}</div>

                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => removeItem(it.id)}
                  disabled={busyId === it.id}
                  aria-label="Fjern fra Bar"
                  title="Fjern"
                >
                  {busyId === it.id ? "Fjerner…" : "Fjern"}
                </button>
              </div>

              <div className={styles.title}>{pretty}</div>

              <div className={styles.actions}>
                <Link className={styles.primary} href={brewHref(it.product_slug)}>
                  Bryg nu
                </Link>

                <Link className={styles.secondary} href={productHref(it.product_slug)}>
                  Åbn produkt
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {!shown.length ? (
        <div className={styles.noResults}>
          Ingen resultater. Prøv at rydde søgning eller skift filter.
        </div>
      ) : null}
    </div>
  );
}
