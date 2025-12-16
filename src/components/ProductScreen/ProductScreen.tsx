"use client"; 

import { useMemo, useState } from "react";
import styles from "./ProductScreen.module.css";

type BrewDNA = { acid: number; body: number; sweet: number };
type TasteNote = { label: string; count: number };
type BrewVariation = { id: string; method: string; description: string; time: string };

type Props = {
  slug: string; // ✅ NY: bruges til inventory
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
  const [preference, setPreference] = useState<"like" | "dislike" | null>(null);

  // Inventory CTA state
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Stub-data (skiftes til Supabase senere)
  const rating = useMemo(() => ({ score: 4.3, count: 5072 }), []);
  const match = useMemo(() => 52, []);

  const dnaBg = useMemo(() => {
    const bodyDeg = Math.max(0, Math.min(1, dna.body)) * 360;
    const acidDeg = Math.max(0, Math.min(1, dna.acid)) * 360;
    const sweetDeg = Math.max(0, Math.min(1, dna.sweet)) * 360;

    const sum = bodyDeg + acidDeg + sweetDeg || 360;
    const b = (bodyDeg / sum) * 360;
    const a = (acidDeg / sum) * 360;
    const s = 360 - b - a;

    return `conic-gradient(
      var(--accent2) 0deg ${b}deg,
      var(--accent1) ${b}deg ${b + a}deg,
      rgba(255,255,255,.14) ${b + a}deg 360deg
    )`;
  }, [dna]);

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
        // json.body er text fra supabase rest
        throw new Error(json?.body || `HTTP ${res.status}`);
      }

      setAdded(true);
    } catch (e: any) {
      setAddError(e?.message || "Kunne ikke tilføje til Bar");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <main className={styles.page}>
      {/* HERO */}
      <header className={styles.hero}>
        <div className={styles.heroTexture} />
        <div className={styles.heroContent}>
          <div className={styles.meta}>{meta}</div>
          <h1 className={styles.title}>{name}</h1>

          {/* Rating + Match (Vivino-feel) */}
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

              <div className={styles.matchActions}>
                <button
                  type="button"
                  className={preference === "like" ? styles.active : ""}
                  onClick={() => setPreference(preference === "like" ? null : "like")}
                >
                  Jeg kan godt lide
                </button>
                <button
                  type="button"
                  className={preference === "dislike" ? styles.active : ""}
                  onClick={() =>
                    setPreference(preference === "dislike" ? null : "dislike")
                  }
                >
                  Jeg kan ikke lide
                </button>
              </div>

              {/* ✅ Add to Bar (ny) */}
              <div className={styles.barActions}>
                <button
                  type="button"
                  className={styles.addToBar}
                  onClick={handleAddToBar}
                  disabled={isAdding || added}
                >
                  {added ? "Tilføjet ✓" : isAdding ? "Tilføjer..." : "Tilføj til Bar"}
                </button>

                {addError ? (
                  <div className={styles.errorText}>{addError}</div>
                ) : null}
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
              Brew DNA er en fællesskabsprofil over hvordan kaffen typisk opleves – så du
              kan vælge smartere.
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

      {/* Sticky CTA (safe-area fixed) */}
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