"use client";

import { useState } from "react";
import ProductScreen from "@/components/ProductScreen/ProductScreen";

type BrewDNA = {
  acid: number;
  body: number;
  sweet: number;
};

type TasteNote = {
  label: string;
  count: number;
};

type BrewVariation = {
  id: string;
  method: string;
  description: string;
  time: string;
};

type Props = {
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

export default function ProductScreen({
  name,
  meta,
  dna,
  tasteSummary,
  tasteNotes,
  recommendedBrew,
  variations,
}: Props) {
  const [preference, setPreference] = useState<"like" | "dislike" | null>(null);

  return (
    <main className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroTexture} />
        <div className={styles.heroContent}>
          <div className={styles.meta}>{meta}</div>
          <h1 className={styles.title}>{name}</h1>

          {/* Match for dig */}
          <div className={styles.matchRow}>
            <div className={styles.matchBadge}>
              <strong>52%</strong>
              <span>Match for dig</span>
            </div>

            <div className={styles.matchActions}>
              <button
                className={preference === "like" ? styles.active : ""}
                onClick={() => setPreference("like")}
              >
                Jeg kan godt lide
              </button>
              <button
                className={preference === "dislike" ? styles.active : ""}
                onClick={() => setPreference("dislike")}
              >
                Jeg kan ikke lide
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* BREW DNA */}
      <section className={styles.section}>
        <h2>Brew DNA</h2>
        <p className={styles.hint}>Hvordan kaffen opleves</p>

        <div className={styles.dnaCard}>
          <div
            className={styles.dnaPie}
            style={{
              background: `conic-gradient(
                var(--accent2) 0deg ${dna.body * 360}deg,
                var(--accent1) ${dna.body * 360}deg ${
                (dna.body + dna.acid) * 360
              }deg,
                rgba(255,255,255,.12) ${
                  (dna.body + dna.acid) * 360
                }deg 360deg
              )`,
            }}
          />

          <div className={styles.dnaLabels}>
            <span>Syre</span>
            <span>Krop</span>
            <span>Sødme</span>
          </div>

          <div className={styles.socialProof}>
            Mest brygget som <strong>Pour-over</strong> (62%)
          </div>
        </div>
      </section>

      {/* SMAGSRETNING */}
      <section className={styles.section}>
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

      {/* ANBEFALET BRYG */}
      <section className={styles.primaryAction}>
        <div>
          <strong>{recommendedBrew.method}</strong>
          <span>{recommendedBrew.reason}</span>
        </div>

        <a href={recommendedBrew.href} className={styles.cta}>
          BRYG NU
          <small>{recommendedBrew.time}</small>
        </a>
      </section>

      {/* VARIATIONER */}
      <section className={styles.section}>
        <h2>Bryg-variationer</h2>

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

      {/* SECONDARY */}
      <section className={styles.secondary}>
        <button>Tilføj til Bar</button>
        <button>Se anmeldelser</button>
      </section>
    </main>
  );
}