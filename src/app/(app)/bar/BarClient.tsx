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

type BrewStat = {
  product_slug: string;
  brew_count: number;
  last_brewed_at: string | null;
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
type SortMode = "recent" | "az" | "za" | "most_brewed" | "last_brewed";

function fmtRelativeDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "short" });
}

function prettyName(slug: string) {
  return slug.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BarClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Record<string, BrewStat>>({});
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

      // inventory
      const invRes = await fetch(
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

      const invText = await invRes.text();
      if (!invRes.ok) throw new Error(invText || `HTTP ${invRes.status}`);
      const inv = invText ? (JSON.parse(invText) as Item[]) : [];
      setItems(inv);

      // brew_stats (view)
      const stRes = await fetch(
        `${url}/rest/v1/brew_stats?select=product_slug,brew_count,last_brewed_at&user_key=eq.${encodeURIComponent(
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

      const stText = await stRes.text();
      if (stRes.ok) {
        const rows = stText ? (JSON.parse(stText) as BrewStat[]) : [];
        const map: Record<string, BrewStat> = {};
        for (const r of rows) map[r.product_slug] = r;
        setStats(map);
      } else {
        setStats({});
      }
    } catch (e: any) {
      setError(e?.message || "Kunne ikke hente Bar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const onBrew = () => load();
    window.addEventListener("brewnote_brew_logged", onBrew);
    return () => window.removeEventListener("brewnote_brew_logged", onBrew);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeItem(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);

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
      setItems(prev);
      setError(e?.message || "Kunne ikke fjerne");
    } finally {
      setBusyId(null);
    }
  }

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = items.slice();

    if (filter !== "all") {
      list = list.filter((it) => {
        const tea = isTeaSlug(it.product_slug);
        return filter === "tea" ? tea : !tea;
      });
    }

    if (query) {
      list = list.filter((it) =>
        it.product_slug.replaceAll("-", " ").toLowerCase().includes(query)
      );
    }

    const getCount = (slug: string) => stats[slug]?.brew_count ?? 0;
    const getLast = (slug: string) => (stats[slug]?.last_brewed_at ? new Date(stats[slug]!.last_brewed_at!).getTime() : 0);

    if (sort === "recent") {
      list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    } else if (sort === "az") {
      list.sort((a, b) => a.product_slug.localeCompare(b.product_slug, "da", { sensitivity: "base" }));
    } else if (sort === "za") {
      list.sort((a, b) => b.product_slug.localeCompare(a.product_slug, "da", { sensitivity: "base" }));
    } else if (sort === "most_brewed") {
      list.sort((a, b) => {
        const d = getCount(b.product_slug) - getCount(a.product_slug);
        if (d !== 0) return d;
        return (a.created_at < b.created_at ? 1 : -1);
      });
    } else if (sort === "last_brewed") {
      list.sort((a, b) => {
        const d = getLast(b.product_slug) - getLast(a.product_slug);
        if (d !== 0) return d;
        return (a.created_at < b.created_at ? 1 : -1);
      });
    }

    return list;
  }, [items, filter, sort, q, stats]);

  if (loading) return <div className={styles.loading}>Indlæser…</div>;

  if (error)
    return (
      <div className={styles.errorCard}>
        <div className={styles.errorTitle}>Fejl</div>
        <div className={styles.errorBody}>{error}</div>
        <button className={styles.retry} onClick={load} type="button">Prøv igen</button>
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
          <Link className={styles.emptyLink} href="/coffees/espresso-blend">Åbn en kaffe →</Link>
        </div>
      </div>
    );

  return (
    <div>
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
          <button type="button" className={filter === "all" ? styles.pillActive : styles.pill} onClick={() => setFilter("all")}>Alle</button>
          <button type="button" className={filter === "coffee" ? styles.pillActive : styles.pill} onClick={() => setFilter("coffee")}>Kaffe</button>
          <button type="button" className={filter === "tea" ? styles.pillActive : styles.pill} onClick={() => setFilter("tea")}>Te</button>
        </div>

        <div className={styles.sortRow}>
          <div className={styles.sortLabel}>Sorter</div>
          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="recent">Senest tilføjet</option>
            <option value="most_brewed">Mest brygget</option>
            <option value="last_brewed">Sidst brygget</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
          <div className={styles.count}>{shown.length} / {items.length}</div>
        </div>
      </div>

      <div className={styles.grid}>
        {shown.map((it) => {
const pretty = prettyName(it.product_slug);
          const tea = isTeaSlug(it.product_slug);
          const st = stats[it.product_slug];
          const brewCount = st?.brew_count ?? 0;
          const last = st?.last_brewed_at ?? null;

          return (
            <article key={it.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.kicker}>{tea ? "Te" : "Kaffe"}</div>
                <button type="button" className={styles.remove} onClick={() => removeItem(it.id)} disabled={busyId === it.id}>
                  {busyId === it.id ? "Fjerner…" : "Fjern"}
                </button>
              </div>

              <div className={styles.title}>{pretty}</div>
<div className={styles.metaLine}>
  {tea ? "Te" : "Kaffe"} · Tilføjet {fmtRelativeDate(it.created_at)}
</div>

              <div className={styles.statsRow}>
                <span className={styles.statPill}>{brewCount} bryg</span>
                {last ? <span className={styles.statMuted}>Sidst: {fmtRelativeDate(last)}</span> : <span className={styles.statMuted}>Ikke brygget endnu</span>}
              </div>

              <div className={styles.actions}>
                <Link className={styles.primary} href={brewHref(it.product_slug)}>Bryg nu</Link>
                <Link className={styles.secondary} href={productHref(it.product_slug)}>Åbn produkt</Link>
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
