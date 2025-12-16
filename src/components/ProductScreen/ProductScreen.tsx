"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ProductScreen.module.css";

type BrewDNA = { acid: number; body: number; sweet: number };
type TasteNote = { label: string; count: number };
type BrewVariation = { id: string; method: string; description: string; time: string };

type Props = {
  slug: string; // ✅ bruges til inventory + feedback + latest brew
  name: string;
  meta: string;

  dna: BrewDNA;

  tasteSummary: string;
  tasteNotes: TasteNote[];

  recommendedBrew: {
    method: string;
    time: string;
    reason: string;
    href: string;
  };

  variations: BrewVariation[];
};

type Tab = "overview" | "brew" | "reviews" | "learn";

type LatestBrew = {
  created_at: string;
  method: string | null;
  ratio_label: string | null;
  dose_g: number | null;
  water_g: number | null;
  total_seconds: number | null;
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

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function formatTime(total: number | null) {
  if (!total || total < 0) return "—";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ProductScreen({
  slug,
  name,
  meta,
  dna,
  tasteSummary,
  tasteNotes,
  recommendedBrew,
  variations,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  // preference state (like/dislike)
  const [preference, setPreference] = useState<"like" | "dislike" | null>(null);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);

  // Inventory CTA state
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [checkingAdded, setCheckingAdded] = useState(true);

  // Latest brew state
  const [latest, setLatest] = useState<LatestBrew | null>(null);
  const [latestLoading, setLatestLoading] = useState(true);

  // Stub-data (skiftes til Supabase senere)
  const rating = useMemo(() => ({ score: 4.3, count: 5072 }), []);
  const match = useMemo(() => 52, []);

  const dnaBg = useMemo(() => {
    const bodyDeg = clamp01(dna.body) * 360;
    const acidDeg = clamp01(dna.acid) * 360;
    const sweetDeg = clamp01(dna.sweet) * 360;

    const sum = bodyDeg + acidDeg + sweetDeg || 360;
    const b = (bodyDeg / sum) * 360;
    const a = (acidDeg / sum) * 360;

    return `conic-gradient(
      var(--accent2) 0deg ${b}deg,
      var(--accent1) ${b}deg ${b + a}deg,
      rgba(255,255,255,.14) ${b + a}deg 360deg
    )`;
  }, [dna]);

  // -------- Supabase REST helpers (no supabase-js) --------

  function supaEnv() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Missing Supabase env vars");
    return { url, anon };
  }

  async function sbFetch(path: string, init: RequestInit, userKey?: string) {
    const { url, anon } = supaEnv();
    const headers = new Headers(init.headers);

    headers.set("apikey", anon);
    headers.set("Authorization", `Bearer ${anon}`);
    headers.set("Content-Type", "application/json");
    if (userKey) headers.set("x-user-key", userKey); // ✅ matcher RLS policies

    const res = await fetch(`${url}${path}`, { ...init, headers, cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    return text ? JSON.parse(text) : null;
  }

  // -------- On mount: check inventory + load preference + latest brew --------

  useEffect(() => {
    let alive = true;

    async function boot() {
      const user_key = getUserKey();

      // 1) Check "added" (inventory exists?)
      setCheckingAdded(true);
      setAddError(null);

      try {
        const data = await sbFetch(
          `/rest/v1/inventory?select=id&user_key=eq.${encodeURIComponent(
            user_key
          )}&product_slug=eq.${encodeURIComponent(slug)}&limit=1`,
          { method: "GET" },
          user_key
        );

        if (!alive) return;
        setAdded(Array.isArray(data) && data.length > 0);
      } catch {
        if (!alive) return;
        setAddError(null);
      } finally {
        if (alive) setCheckingAdded(false);
      }

      // 2) Load preference (if exists)
      setPrefError(null);
      try {
        const data = await sbFetch(
          `/rest/v1/product_feedback?select=preference&user_key=eq.${encodeURIComponent(
            user_key
          )}&product_slug=eq.${encodeURIComponent(slug)}&limit=1`,
          { method: "GET" },
          user_key
        );

        if (!alive) return;
        const p = Array.isArray(data) && data[0]?.preference;
        if (p === "like" || p === "dislike") setPreference(p);
      } catch {
        // ignore
      }

      // 3) Load latest brew (via API route)
      setLatestLoading(true);
      try {
        const res = await fetch(
          `/api/brew/latest?user_key=${encodeURIComponent(user_key)}&product_slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );

        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.body || `HTTP ${res.status}`);

        if (!alive) return;
        setLatest(json.latest || null);
      } catch {
        if (!alive) return;
        setLatest(null);
      } finally {
        if (alive) setLatestLoading(false);
      }
    }

    boot();
    return () => {
      alive = false;
    };
  }, [slug]);

  // -------- Actions --------

  async function handleAddToBar() {
    if (isAdding || added) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const user_key = getUserKey();

      const res = await fetch("/api/inventory/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_key, product_slug: slug }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json?.body || `HTTP ${res.status}`);
      }

      setAdded(true);
    } catch (e: any) {
      setAddError(e?.message || "Kunne ikke tilføje til Bar");
    } finally {
      setIsAdding(false);
    }
  }

  async function savePreference(next: "like" | "dislike" | null) {
    setPreference(next);
    setPrefError(null);

    // (slet preference senere; nu gemmer vi kun hvis valgt)
    if (!next) return;

    setPrefSaving(true);

    try {
      const user_key = getUserKey();

      await sbFetch(
        `/rest/v1/product_feedback?on_conflict=user_key,product_slug`,
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify([{ user_key, product_slug: slug, preference: next }]),
        },
        user_key
      );
    } catch (e: any) {
      setPrefError(e?.message || "Kunne ikke gemme preference");
    } finally {
      setPrefSaving(false);
    }
  }

  const addBtnLabel = added
    ? "Tilføjet ✓"
    : checkingAdded
    ? "Tjekker…"
    : isAdding
    ? "Tilføjer…"
    : "Tilføj til Bar";

  return (
    <main className={styles.page}>
      {/* HERO */}
      <header className={styles.hero}>
        <div className={styles.heroTexture} />
        <div className={styles.heroContent}>
          <div className={styles.meta}>{meta}</div>
          <h1 className={styles.title}>{name}</h1>

          {/* Rating + Match */}
          <div className={styles.heroStats}>
            <div className={styles.ratingBlock}>
              <div className={styles.ratingScore}>
                {rating.score.toFixed(1).replace(".", ",")}
              </div>
              <div className={styles.stars} aria-label={`${rating.score} ud af 5`}>
                ★★★★☆
              </div>
              <div className={styles.ratingCount}>
                {rating.count.toLocaleString("da-DK")} bedømmelser
              </div>
            </div>

            <div className={styles.matchBlock}>
              <div className={styles.matchPill}>
                <span className={styles.matchDot} />
                <strong>{match}%</strong>
                <span>Match for dig</span>
              </div>

              {/* Like/Dislike */}
              <div className={styles.matchActions}>
                <button
                  type="button"
                  className={preference === "like" ? styles.active : ""}
                  onClick={() => savePreference(preference === "like" ? null : "like")}
                  disabled={prefSaving}
                >
                  Jeg kan godt lide
                </button>
                <button
                  type="button"
                  className={preference === "dislike" ? styles.active : ""}
                  onClick={() => savePreference(preference === "dislike" ? null : "dislike")}
                  disabled={prefSaving}
                >
                  Jeg kan ikke lide
                </button>
              </div>

              {prefError ? <div className={styles.errorText}>{prefError}</div> : null}

              {/* Add to Bar */}
              <div className={styles.barActions}>
                <button
                  type="button"
                  className={styles.addToBar}
                  onClick={handleAddToBar}
                  disabled={checkingAdded || isAdding || added}
                >
                  {addBtnLabel}
                </button>

                {addError ? <div className={styles.errorText}>{addError}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className={styles.tabs} aria-label="Produkt navigation">
        <button
          type="button"
          className={tab === "overview" ? styles.tabActive : styles.tab}
          onClick={() => setTab("overview")}
        >
          Overblik
        </button>
        <button
          type="button"
          className={tab === "brew" ? styles.tabActive : styles.tab}
          onClick={() => setTab("brew")}
        >
          Bryg
        </button>
        <button
          type="button"
          className={tab === "reviews" ? styles.tabActive : styles.tab}
          onClick={() => setTab("reviews")}
        >
          Vurderinger
        </button>
        <button
          type="button"
          className={tab === "learn" ? styles.tabActive : styles.tab}
          onClick={() => setTab("learn")}
        >
          Lær
        </button>
      </nav>

      {/* Content */}
      {tab === "overview" && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Brew DNA</h2>
              <p className={styles.hint}>Hvordan kaffen opleves (fællesskab)</p>
            </div>
            <button className={styles.linkButton} type="button">
              Se forklaring
            </button>
          </div>

          <div className={styles.dnaCard}>
            <div className={styles.dnaPie} style={{ background: dnaBg }} />
            <div className={styles.dnaLabels}>
              <span>Syre</span>
              <span>Krop</span>
              <span>Sødme</span>
            </div>
            <div className={styles.socialProof}>
              Mest brygget som <strong>{recommendedBrew.method}</strong> (62%)
            </div>
          </div>

          {/* ✅ Din seneste bryg */}
          <div className={styles.spacer} />
          <div className={styles.latestCard}>
            <div className={styles.latestTop}>
              <h3>Din seneste bryg</h3>
              <span className={styles.latestMeta}>
                {latestLoading ? "Indlæser…" : latest ? "Logget" : "Ingen endnu"}
              </span>
            </div>

            {latest ? (
              <div className={styles.latestGrid}>
                <div>
                  <div className={styles.latestLabel}>Metode</div>
                  <div className={styles.latestValue}>{latest.method || "—"}</div>
                </div>
                <div>
                  <div className={styles.latestLabel}>Tid</div>
                  <div className={styles.latestValue}>
                    {formatTime(latest.total_seconds)}
                  </div>
                </div>
                <div>
                  <div className={styles.latestLabel}>Ratio</div>
                  <div className={styles.latestValue}>{latest.ratio_label || "—"}</div>
                </div>
                <div>
                  <div className={styles.latestLabel}>Dose / vand</div>
                  <div className={styles.latestValue}>
                    {latest.dose_g ?? "—"}g / {latest.water_g ?? "—"}g
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.latestEmpty}>
                Bryg denne én gang, så begynder BrewNote at lære din stil.
              </div>
            )}
          </div>

          <div className={styles.spacer} />

          <h2>Smagsretning</h2>
          <p className={styles.summary}>{tasteSummary}</p>

          <div className={styles.tags}>
            {tasteNotes.map((t) => (
              <span key={t.label} className={styles.tag}>
                {t.label} <em>{t.count}</em>
              </span>
            ))}
          </div>

          <h3 className={styles.subTitle}>Passer godt til</h3>
          <div className={styles.moments}>
            <span>Morgen</span>
            <span>Eftermiddag</span>
            <span>Dessert</span>
            <span>Fokus</span>
          </div>
        </section>
      )}

      {tab === "brew" && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Bryg</h2>
              <p className={styles.hint}>Anbefalet opskrift + presets</p>
            </div>
          </div>

          <div className={styles.brewHeroCard}>
            <div>
              <div className={styles.brewHeroTitle}>{recommendedBrew.method}</div>
              <div className={styles.brewHeroReason}>{recommendedBrew.reason}</div>
            </div>
            <div className={styles.brewHeroTime}>{recommendedBrew.time}</div>
          </div>

          <div className={styles.variations}>
            {variations.map((v) => (
              <div key={v.id} className={styles.variationCard}>
                <div className={styles.variationTop}>
                  <strong>{v.method}</strong>
                  <span>{v.time}</span>
                </div>
                <p>{v.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "reviews" && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Vurderinger</h2>
              <p className={styles.hint}>Hvad folk siger (stub lige nu)</p>
            </div>
            <button className={styles.primaryMini} type="button">
              Skriv review
            </button>
          </div>

          <div className={styles.reviewCard}>
            <div className={styles.reviewTop}>
              <span className={styles.reviewBadge}>★ 4,6</span>
              <span className={styles.reviewMeta}>For 4 måneder siden</span>
            </div>
            <p className={styles.reviewText}>
              “Flot, rund kop med chokolade og ristede noter. God balance.”
            </p>
          </div>

          <div className={styles.reviewCard}>
            <div className={styles.reviewTop}>
              <span className={styles.reviewBadge}>★ 4,4</span>
              <span className={styles.reviewMeta}>For 1 år siden</span>
            </div>
            <p className={styles.reviewText}>
              “Fyldig og behagelig. Passer perfekt til eftermiddag.”
            </p>
          </div>

          <button className={styles.linkFull} type="button">
            Vis alle vurderinger →
          </button>
        </section>
      )}

      {tab === "learn" && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Lær</h2>
              <p className={styles.hint}>Origin / roaster / guides (stub)</p>
            </div>
          </div>

          <div className={styles.learnCard}>
            <h3>Hvad betyder Brew DNA?</h3>
            <p>
              Brew DNA er en fællesskabsprofil over hvordan kaffen typisk opleves – så
              du kan vælge smartere.
            </p>
            <button className={styles.primaryMini} type="button">
              Åbn guide
            </button>
          </div>

          <div className={styles.learnCard}>
            <h3>Sådan rammer du bedre krop & sødme</h3>
            <p>Små tweaks: temperatur, ratio og pour-pattern kan ændre alt.</p>
            <button className={styles.primaryMini} type="button">
              Læs mere
            </button>
          </div>
        </section>
      )}

      {/* Sticky CTA */}
      <footer className={styles.stickyBar}>
        <div className={styles.stickyInner}>
          <div className={styles.stickyLeft}>
            <div className={styles.stickyMethod}>{recommendedBrew.method}</div>
            <div className={styles.stickyReason}>{recommendedBrew.reason}</div>
          </div>

          <a className={styles.cta} href={recommendedBrew.href}>
            <span>BRYG NU</span>
            <small>{recommendedBrew.time}</small>
          </a>
        </div>
      </footer>
    </main>
  );
}