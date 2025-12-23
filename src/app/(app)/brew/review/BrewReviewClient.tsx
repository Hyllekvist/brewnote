"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./BrewReviewClient.module.css";

type Domain = "coffee" | "tea";

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// --- user_key (samme som BrewClient) ---
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

// samme pseudo-variant-id logik som i BrewClient
function fnv1a32(str: string, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function stableUuidFromString(input: string) {
  const h1 = fnv1a32(input, 0x811c9dc5);
  const h2 = fnv1a32(input, 0x811c9dc5 ^ 0x9e3779b9);
  const h3 = fnv1a32(input, 0x811c9dc5 ^ 0x7f4a7c15);
  const h4 = fnv1a32(input, 0x811c9dc5 ^ 0x94d049bb);

  const b = new Uint8Array(16);
  const parts = [h1, h2, h3, h4];
  for (let p = 0; p < 4; p++) {
    const x = parts[p];
    b[p * 4 + 0] = (x >>> 24) & 0xff;
    b[p * 4 + 1] = (x >>> 16) & 0xff;
    b[p * 4 + 2] = (x >>> 8) & 0xff;
    b[p * 4 + 3] = x & 0xff;
  }

  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;

  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function prettyNameFromSlug(slug: string) {
  return slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew";
}

type TopPick = {
  variant_id: string;
  product_slug?: string | null;
  label?: string | null;
  score: number;
  dist: number;
  why?: string[];
};

type LatestReview = {
  created_at?: string;
  stars?: number;
  quick?: "sour" | "balanced" | "bitter" | null;
  note?: string | null;
  method?: string | null;
  seconds?: number | null;
};

export default function BrewReviewClient({
  type,
  slug,
  seconds,
  method,
}: {
  type: string;
  slug: string;
  seconds: number;
  method: string;
}) {
  const domain: Domain = type === "tea" ? "tea" : "coffee";

  const name = useMemo(() => prettyNameFromSlug(slug), [slug]);
  const variantId = useMemo(() => stableUuidFromString(`${domain}:${slug}`), [domain, slug]);

  const [rating, setRating] = useState<number>(0);
  const [quick, setQuick] = useState<"sour" | "balanced" | "bitter" | null>(null);
  const [note, setNote] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [topPick, setTopPick] = useState<TopPick | null>(null);

  const [latest, setLatest] = useState<LatestReview | null>(null);

  const backHref = slug ? `/coffees/${encodeURIComponent(slug)}` : "/";

  // ✅ Prefill from latest review
  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    (async () => {
      try {
        const user_key = getUserKey();
        const qs = new URLSearchParams({ user_key, product_slug: slug });

        const res = await fetch(`/api/review/latest?${qs.toString()}`, { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.ok || cancelled) return;

        const r = (json.latest ?? null) as LatestReview | null;
        if (!r) return;

        setLatest(r);

        if (typeof r.stars === "number" && r.stars >= 1 && r.stars <= 5) setRating(r.stars);
        if (r.quick === "sour" || r.quick === "balanced" || r.quick === "bitter") setQuick(r.quick);
        if (typeof r.note === "string" && r.note.trim()) setNote(r.note.trim());
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function saveReview() {
    if (rating === 0 || isSaving) return;
    setIsSaving(true);
    setSaveMsg(null);
    setTopPick(null);

    try {
      // 1) lær profilen (taste/rate)
      const user_key = getUserKey();

const res = await fetch("/api/taste/rate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    user_key, // ✅ vigtigt for taste_ratings
    variant_id: variantId,
    domain,
    stars: rating,
    product_slug: slug,
    label: name,
    quick,
  }),
});

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Kunne ikke gemme rating");

      // 1b) gem review-log (note + quick + metadata)
      const rr = await fetch("/api/brew/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: variantId,
          domain,
          stars: rating,
          quick,
          note,
          product_slug: slug,
          method,
          seconds,
        }),
      });

      const rrJson = await rr.json().catch(() => ({}));
      if (!rr.ok) throw new Error(rrJson?.error || "Kunne ikke gemme review-log");

      setSaveMsg("Review gemt. Vi lærer din smag…");

      // 2) hent top pick
      const rec = await fetch(`/api/taste/recommend?domain=${domain}&limit=1`, { method: "GET" });
      const recJson = await rec.json().catch(() => ({}));

      if (rec.ok && recJson?.ok && Array.isArray(recJson.items) && recJson.items[0]) {
        setTopPick(recJson.items[0] as TopPick);
        setSaveMsg("Gemte. Her er dit bedste match lige nu:");
      } else {
        setSaveMsg("Gemte. Giv 1-2 reviews mere for at få anbefalinger.");
      }
    } catch (e: any) {
      setSaveMsg(e?.message || "Noget gik galt");
    } finally {
      setIsSaving(false);
    }
  }

  const topPickHref =
    topPick?.product_slug ? `/brew/${domain}/${encodeURIComponent(topPick.product_slug)}` : null;

  const whyLine = topPick?.why?.length ? topPick.why.slice(0, 3).join(" · ") : null;

  // ✅ NEW: rule-based tips from quick
  const tips = useMemo(() => {
    if (quick === "bitter") {
      return domain === "coffee"
        ? ["Prøv 1–2 klik grovere kværn", "Sænk vandtemperaturen 1–2°C"]
        : ["Kortere trækketid", "Sænk vandtemperaturen 2–4°C"];
    }
    if (quick === "sour") {
      return domain === "coffee"
        ? ["Prøv 1–2 klik finere kværn", "Øg tiden lidt (10–20s)"]
        : ["Højere vandtemperatur 2–4°C", "Længere trækketid"];
    }
    if (quick === "balanced") {
      return ["Hold samme opskrift – finjustér kun én ting ad gangen"];
    }
    return [];
  }, [quick, domain]);

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <a className={styles.iconBtn} href={backHref} aria-label="Tilbage">
          ←
        </a>
        <div className={styles.topTitle}>
          <div className={styles.kicker}>REVIEW</div>
          <div className={styles.h1}>
            {domain === "tea" ? "Tea Brew" : "Coffee Brew"} — {name}
          </div>
        </div>
        <a className={styles.iconBtn} href={backHref} aria-label="Luk">
          ✕
        </a>
      </header>

      <section className={styles.card}>
        <div className={styles.metaRow}>
          <span className={styles.pill}>{method}</span>
          <span className={styles.pill}>Time {formatMMSS(seconds)}</span>
        </div>

        <h1 className={styles.title}>Hvordan blev den?</h1>
        <p className={styles.sub}>Giv en hurtig vurdering – så kan vi forbedre din næste bryg.</p>

        <div className={styles.stars} aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={n <= rating ? styles.starOn : styles.starOff}
              onClick={() => setRating(n)}
              type="button"
              aria-label={`${n} stjerner`}
            >
              ★
            </button>
          ))}
        </div>

        <div className={styles.quickRow}>
          <button
            type="button"
            className={quick === "sour" ? styles.quickActive : styles.quick}
            onClick={() => setQuick("sour")}
          >
            For sur
          </button>
          <button
            type="button"
            className={quick === "balanced" ? styles.quickActive : styles.quick}
            onClick={() => setQuick("balanced")}
          >
            Perfekt
          </button>
          <button
            type="button"
            className={quick === "bitter" ? styles.quickActive : styles.quick}
            onClick={() => setQuick("bitter")}
          >
            For bitter
          </button>
        </div>

        {/* ✅ NEW: Tips (inserted right under quickRow, before textarea) */}
        {tips.length ? (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>NÆSTE GANG</div>
            {tips.slice(0, 2).map((t, i) => (
              <div key={i}>• {t}</div>
            ))}
          </div>
        ) : null}

        <label className={styles.label}>
          Noter (valgfrit)
          <textarea
            className={styles.textarea}
            placeholder="Fx: lidt for fin kværn – næste gang 1 klik grovere."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {latest?.created_at ? (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Sidste review: {new Date(latest.created_at).toLocaleDateString("da-DK")}
          </div>
        ) : null}

        {saveMsg ? <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>{saveMsg}</div> : null}

        {topPick ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75 }}>TOP PICK FOR YOU</div>

            <div style={{ fontWeight: 800 }}>
              {topPick.label || prettyNameFromSlug(String(topPick.product_slug || "")) || "Recommended"}
            </div>

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Match: {Math.round((topPick.score ?? 0) * 100)}%
            </div>

            {whyLine ? <div style={{ fontSize: 12, opacity: 0.75 }}>{whyLine}</div> : null}

            {topPickHref ? (
              <a href={topPickHref} className={styles.primary} style={{ textAlign: "center", marginTop: 8 }}>
                Bryg dette
              </a>
            ) : null}
          </div>
        ) : null}

        <div className={styles.actions}>
          <a className={styles.secondary} href={backHref}>
            Spring over
          </a>
          <button className={styles.primary} type="button" onClick={saveReview} disabled={rating === 0 || isSaving}>
            {isSaving ? "Gemmer..." : "Gem review"}
          </button>
        </div>
      </section>
    </main>
  );
}