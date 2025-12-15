"use client";

import { useMemo, useState } from "react";
import styles from "./ProductScreen.module.css";

type BrewDNA = { acid: number; body: number; sweet: number };

type BrewPreset = {
  id: string;
  method: string;
  description: string;
  time: string;
  // social proof pr preset (valgfri)
  popularityPct?: number; // 0-100
};

type TasteNote = { label: string; count: number };

type MatchState = "like" | "dislike" | "neutral";

type Props = {
  name: string;
  meta: string; // "Coffee · Origin · Roaster"
  dna: BrewDNA;

  // ✅ personlig match (Vivino-lag)
  user?: {
    matchPct?: number; // 0-100
    state?: MatchState; // like/dislike/neutral
  };

  // ✅ social proof (Vivino-lag)
  crowd?: {
    ratingsCount?: number; // “baseret på X”
    topPctWorld?: number; // top X% i verden
    topPctCategory?: number; // top X% i kategori
    mostBrewed?: { method: string; pct: number }; // “Mest brygget som”
  };

  // ✅ brugssituationer (Vivino-lag)
  moments?: string[]; // fx ["Morgen", "Eftermiddag", "Dessert", "Fokus"]

  tasteSummary: string;
  tasteNotes: TasteNote[];

  recommendedBrew: {
    method: string;
    time: string;
    reason: string;
    href: string;
  };

  variations: BrewPreset[];
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function dnaToPieAngles(dna: BrewDNA) {
  const a = clamp01(dna.acid);
  const b = clamp01(dna.body);
  const s = clamp01(dna.sweet);
  const sum = a + b + s || 1;
  return {
    acid: (a / sum) * 360,
    body: (b / sum) * 360,
    sweet: (s / sum) * 360,
  };
}

export default function ProductScreen({
  name,
  meta,
  dna,
  user,
  crowd,
  moments,
  tasteSummary,
  tasteNotes,
  recommendedBrew,
  variations,
}: Props) {
  const [matchState, setMatchState] = useState<MatchState>(user?.state || "neutral");

  const angles = useMemo(() => dnaToPieAngles(dna), [dna]);

  const matchPct = user?.matchPct;
  const showMatch = typeof matchPct === "number";

  return (
    <main className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroTexture} />
        <div className={styles.heroContent}>
          <div className={styles.meta}>{meta}</div>
          <h1 className={styles.title}>{name}</h1>

          {/* ✅ PERSONLIG MATCH (Vivino “Match for dig”) */}
          {showMatch ? (
            <div className={styles.matchRow}>
              <div className={styles.matchBadge} aria-label="Match for dig">
                <span className={styles.matchPct}>{matchPct}%</span>
                <span className={styles.matchLabel}>Match for dig</span>
              </div>

              <div className={styles.matchActions}>
                <button
                  type="button"
                  className={`${styles.matchBtn} ${matchState === "like" ? styles.matchBtnActive : ""}`}
                  onClick={() => setMatchState(matchState === "like" ? "neutral" : "like")}
                >
                  Jeg kan godt lide
                </button>
                <button
                  type="button"
                  className={`${styles.matchBtn} ${matchState === "dislike" ? styles.matchBtnActive : ""}`}
                  onClick={() => setMatchState(matchState === "dislike" ? "neutral" : "dislike")}
                >
                  Jeg kan ikke lide
                </button>
              </div>
            </div>
          ) : null}

          {/* ✅ SOCIAL PROOF: ranking + counts */}
          {(crowd?.ratingsCount || crowd?.topPctWorld || crowd?.topPctCategory) ? (
            <div className={styles.proofRow}>
              {typeof crowd?.ratingsCount === "number" ? (
                <div className={styles.proofPill}>
                  Baseret på <strong>{crowd.ratingsCount.toLocaleString("da-DK")}</strong> bryg
                </div>
              ) : null}

              {typeof crowd?.topPctWorld === "number" ? (
                <div className={styles.proofPill}>
                  Top <strong>{crowd.topPctWorld}%</strong> i verden
                </div>
              ) : null}

              {typeof crowd?.topPctCategory === "number" ? (
                <div className={styles.proofPill}>
                  Top <strong>{crowd.topPctCategory}%</strong> i stilen
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* BREW DNA */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Brew DNA</h2>
          <button className={styles.linkBtn} type="button">
            Se forklaring
          </button>
        </div>
        <p className={styles.sectionHint}>Hvordan kaffen opleves (fællesskab)</p>

        <div className={styles.dnaCard}>
          <div className={styles.dnaVisual}>
            <div
              className={styles.dnaPie}
              style={
                {
                  "--degBody": `${angles.body}deg`,
                  "--degAcid": `${angles.acid}deg`,
                  "--degSweet": `${angles.sweet}deg`,
                } as React.CSSProperties
              }
            />
          </div>

          <div className={styles.dnaLabels}>
            <span>Syre</span>
            <span>Krop</span>
            <span>Sødme</span>
          </div>

          {/* ✅ SOCIAL PROOF: “mest brygget som …” */}
          {crowd?.mostBrewed ? (
            <div className={styles.mostBrewed}>
              Mest brygget som <strong>{crowd.mostBrewed.method}</strong> ({crowd.mostBrewed.pct}%)
            </div>
          ) : null}
        </div>
      </section>

      {/* SMAGSRETNING */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Smagsretning</h2>
        <p className={styles.summary}>{tasteSummary}</p>

        <div className={styles.tags}>
          {tasteNotes.slice(0, 10).map((t) => (
            <span key={t.label} className={styles.tag}>
              {t.label}
              <span className={styles.tagCount}>{t.count}</span>
            </span>
          ))}
        </div>

        {/* ✅ BRUGSSITUATIONER (Vivino “Passer godt sammen med”) */}
        {moments?.length ? (
          <>
            <h3 className={styles.subTitle}>Passer godt til</h3>
            <div className={styles.moments}>
              {moments.map((m) => (
                <span key={m} className={styles.moment}>
                  {m}
                </span>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {/* ANBEFALET BRYG */}
      <section className={styles.primaryAction}>
        <div className={styles.primaryLeft}>
          <strong>{recommendedBrew.method}</strong>
          <span>{recommendedBrew.reason}</span>
        </div>

        <a href={recommendedBrew.href} className={styles.cta}>
          BRYG NU
          <span>{recommendedBrew.time}</span>
        </a>
      </section>

      {/* VARIATIONER */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Bryg-variationer</h2>
          <div className={styles.sectionHintInline}>Læring: konsekvens først</div>
        </div>

        <div className={styles.variations}>
          {variations.map((v) => (
            <div key={v.id} className={styles.variationCard}>
              <div className={styles.variationTop}>
                <strong>{v.method}</strong>
                <span className={styles.variationTime}>{v.time}</span>
              </div>

              <p className={styles.variationDesc}>{v.description}</p>

              {typeof v.popularityPct === "number" ? (
                <div className={styles.variationProof}>
                  Populær: <strong>{v.popularityPct}%</strong>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* VURDER & LÆR */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Vurder & lær</h2>
          <button className={styles.linkBtn} type="button">
            Administrer præferencer
          </button>
        </div>
        <p className={styles.sectionHint}>Din feedback forbedrer match og bryg-råd</p>

        <div className={styles.ratingRow}>
          <button type="button">− Syre</button>
          <button type="button">+ Syre</button>
          <button type="button">− Krop</button>
          <button type="button">+ Krop</button>
          <button type="button">− Sødme</button>
          <button type="button">+ Sødme</button>
        </div>
      </section>

      {/* SEKUNDÆRE */}
      <section className={styles.secondary}>
        <button type="button">Tilføj til Bar</button>
        <button type="button">Se anmeldelser</button>
      </section>
    </main>
  );
}