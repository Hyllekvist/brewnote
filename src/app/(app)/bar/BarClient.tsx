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

type FeedbackRow = {
  product_slug: string;
  preference: "like" | "dislike";
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

// Stable pseudo-DNA per slug (0..1). Replacer med rigtig product-dna senere.
function pseudoDNA(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  const a = (h % 1000) / 1000;
  const b = ((h >> 10) % 1000) / 1000;
  const s = ((h >> 20) % 1000) / 1000;
  const clamp = (x: number) => Math.max(0.22, Math.min(0.92, x));
  return { acid: clamp(a), body: clamp(b), sweet: clamp(s) };
}

function supaEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env vars");
  return { url, anon };
}

async function sbGet(path: string, userKey: string) {
  const { url, anon } = supaEnv();
  const res = await fetch(`${url}${path}`, {
    method: "GET",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
      "x-user-key": userKey, // ✅ RLS
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : null;
}

async function sbDelete(path: string, userKey: string) {
  const { url, anon } = supaEnv();
  const res = await fetch(`${url}${path}`, {
    method: "DELETE",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      Prefer: "return=minimal",
      "x-user-key": userKey, // ✅ RLS
    },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return null;
}

type ViewRow = Item & { pref?: "like" | "dislike" };

function prefRank(p?: "like" | "dislike") {
  // likes først, så null, så dislikes
  if (p === "like") return 0;
  if (!p) return 1;
  return 2;
}

export function BarClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [feedback, setFeedback] = useState<Record<string, "like" | "dislike">>(
    {}
  );

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
      // inventory
      const inv = (await sbGet(
        `/rest/v1/inventory?select=id,user_key,product_slug,created_at&user_key=eq.${encodeURIComponent(
          userKey
        )}&order=created_at.desc`,
        userKey
      )) as Item[];

      // feedback (kun preference + slug)
      const fb = (await sbGet(
        `/rest/v1/product_feedback?select=product_slug,preference&user_key=eq.${encodeURIComponent(
          userKey
        )}`,
        userKey
      )) as FeedbackRow[];

      const map: Record<string, "like" | "dislike"> = {};
      for (const r of fb || []) {
        if (r?.product_slug && (r.preference === "like" || r.preference === "dislike")) {
          map[r.product_slug] = r.preference;
        }
      }

      setItems(inv || []);
      setFeedback(map);
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
      const prev = items;
      setItems((x) => x.filter((i) => i.id !== id));

      await sbDelete(
        `/rest/v1/inventory?id=eq.${encodeURIComponent(
          id
        )}&user_key=eq.${encodeURIComponent(userKey)}`,
        userKey
      );
    } catch (e: any) {
      setError(e?.message || "Kunne ikke fjerne item");
      // (valgfrit: reload for at synce)
      load();
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

  const rows: ViewRow[] = items
    .map((it) => ({ ...it, pref: feedback[it.product_slug] }))
    .sort((a, b) => {
      const ra = prefRank(a.pref);
      const rb = prefRank(b.pref);
      if (ra !== rb) return ra - rb;
      // sekundært: nyeste først
      return b.created_at.localeCompare(a.created_at);
    });

  return (
    <div className={styles.grid}>
      {rows.map((it) => {
        const dna = pseudoDNA(it.product_slug);
        const pref = it.pref;

        return (
          <div key={it.id} className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <div className={styles.cardMeta}>I din bar</div>
                <div className={styles.cardTitle}>{prettyName(it.product_slug)}</div>

                {/* preference pill */}
                {pref ? (
                  <div
                    className={[
                      styles.prefPill,
                      pref === "like" ? styles.prefLike : styles.prefDislike,
                    ].join(" ")}
                    aria-label={pref === "like" ? "Du kan lide den" : "Du kan ikke lide den"}
                  >
                    <span className={styles.prefIcon}>{pref === "like" ? "👍" : "👎"}</span>
                    <span>{pref === "like" ? "Matcher dig" : "Ikke for dig"}</span>
                  </div>
                ) : (
                  <div className={styles.prefPillGhost}>Ingen feedback endnu</div>
                )}
              </div>

              <div className={styles.badge}>
                {productType(it.product_slug) === "tea" ? "TE" : "KAFFE"}
              </div>
            </div>

            {/* mini DNA */}
            <div className={styles.miniDNA} aria-label="Mini Brew DNA">
              <div className={styles.miniRow}>
                <span className={styles.miniLabel}>Syre</span>
                <span className={styles.miniTrack}>
                  <span className={styles.miniFill} style={{ width: `${dna.acid * 100}%` }} />
                </span>
              </div>
              <div className={styles.miniRow}>
                <span className={styles.miniLabel}>Krop</span>
                <span className={styles.miniTrack}>
                  <span className={styles.miniFill} style={{ width: `${dna.body * 100}%` }} />
                </span>
              </div>
              <div className={styles.miniRow}>
                <span className={styles.miniLabel}>Sødme</span>
                <span className={styles.miniTrack}>
                  <span className={styles.miniFill} style={{ width: `${dna.sweet * 100}%` }} />
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              <Link className={styles.primaryBtn} href={brewHref(it.product_slug)}>
                Bryg nu
              </Link>

              <Link className={styles.ghostBtn} href={productHref(it.product_slug)}>
                Åbn produkt
              </Link>

              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => removeItem(it.id)}
                disabled={busyId === it.id}
                aria-busy={busyId === it.id}
                aria-label="Fjern fra bar"
                title="Fjern"
              >
                {busyId === it.id ? "…" : "✕"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
