"use client";

import styles from "./ProductScreenV2.module.css";

type BrewDNA = {
  acid: number;
  body: number;
  sweet: number;
};

type BrewPreset = {
  id: string;
  method: string;
  description: string;
  time: string;
};

type TasteNote = {
  label: string;
  count: number;
};

type Props = {
  name: string;
  meta: string; // "Coffee · Origin · Roaster"
  dna: BrewDNA;
  tasteSummary: string; // "Mørk og fyldig med lav syre"
  tasteNotes: TasteNote[];
  recommendedBrew: {
    method: string;
    time: string;
    reason: string;
    href: string;
  };
  variations: BrewPreset[];
};

export default function ProductScreenV2({
  name,
  meta,
  dna,
  tasteSummary,
  tasteNotes,
  recommendedBrew,
  variations,
}: Props) {
  return (
    <main className={styles.page}>
      {/* 1. HERO */}
      <section className={styles.hero}>
        <div className={styles.heroTexture} />
        <div className={styles.heroContent}>
          <div className={styles.meta}>{meta}</div>
          <h1 className={styles.title}>{name}</h1>
        </div>
      </section>

      {/* 2. BREW DNA */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Brew DNA</h2>
        <p className={styles.sectionHint}>Hvordan kaffen opleves</p>

        <div className={styles.dnaCard}>
          <div className={styles.dnaVisual}>
            <div
              className={styles.dnaRing}
              style={{
                "--acid": dna.acid,
                "--body": dna.body,
                "--sweet": dna.sweet,
              } as React.CSSProperties}
            />
          </div>

          <div className={styles.dnaLabels}>
            <span>Syre</span>
            <span>Krop</span>
            <span>Sødme</span>
          </div>
        </div>
      </section>

      {/* 3. SMAGSRETNING */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Smagsretning</h2>
        <p className={styles.summary}>{tasteSummary}</p>

        <div className={styles.tags}>
          {tasteNotes.map((t) => (
            <span key={t.label} className={styles.tag}>
              {t.label}
              <span className={styles.tagCount}>{t.count}</span>
            </span>
          ))}
        </div>
      </section>

      {/* 4. ANBEFALET BRYG */}
      <section className={styles.primaryAction}>
        <div>
          <strong>{recommendedBrew.method}</strong>
          <span>{recommendedBrew.reason}</span>
        </div>

        <a href={recommendedBrew.href} className={styles.cta}>
          BRYG NU
          <span>{recommendedBrew.time}</span>
        </a>
      </section>

      {/* 5. VARIATIONER */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Bryg-variationer</h2>

        <div className={styles.variations}>
          {variations.map((v) => (
            <div key={v.id} className={styles.variationCard}>
              <strong>{v.method}</strong>
              <p>{v.description}</p>
              <span>{v.time}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 6. VURDER & LÆR */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Hvordan var den?</h2>
        <p className={styles.sectionHint}>
          Din vurdering gør anbefalingerne bedre
        </p>

        <div className={styles.ratingRow}>
          <button>− Syre</button>
          <button>+ Syre</button>
          <button>− Krop</button>
          <button>+ Krop</button>
        </div>
      </section>

      {/* 7. SEKUNDÆRE */}
      <section className={styles.secondary}>
        <button>Tilføj til Bar</button>
        <button>Se anmeldelser</button>
      </section>
    </main>
  );
}