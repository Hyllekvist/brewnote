"use client";

import { useMemo, useState } from "react";
import styles from "./BrewReviewClient.module.css";

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
  const name = useMemo(() => {
    return slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew";
  }, [slug]);

  const [rating, setRating] = useState<number>(0);
  const [quick, setQuick] = useState<"sour" | "balanced" | "bitter" | null>(null);
  const [note, setNote] = useState("");

  const backHref = slug ? `/coffees/${encodeURIComponent(slug)}` : "/";

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <a className={styles.iconBtn} href={backHref} aria-label="Tilbage">←</a>
        <div className={styles.topTitle}>
          <div className={styles.kicker}>REVIEW</div>
          <div className={styles.h1}>{type === "tea" ? "Tea Brew" : "Coffee Brew"} — {name}</div>
        </div>
        <a className={styles.iconBtn} href={backHref} aria-label="Luk">✕</a>
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

        <label className={styles.label}>
          Noter (valgfrit)
          <textarea
            className={styles.textarea}
            placeholder="Fx: lidt for fin kværn – næste gang 1 klik grovere."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className={styles.actions}>
          <a className={styles.secondary} href={backHref}>Spring over</a>
          <button
            className={styles.primary}
            type="button"
            onClick={() => {
              // v1: ingen DB endnu. Næste step: skriv til Supabase.
              alert("Saved (v1). Next: persist to Supabase.");
            }}
            disabled={rating === 0}
          >
            Gem review
          </button>
        </div>
      </section>
    </main>
  );
}