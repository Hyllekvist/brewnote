"use client";

import styles from "./PrepStage.module.css";

type PrepSummary = {
  title: string;          // fx "V60 — Classic"
  doseG: number;          // fx 18
  waterG: number;         // fx 300
  ratioLabel?: string;    // fx "1:16.7"
  estTotalSeconds?: number;
};

type Props = {
  summary: PrepSummary;
  onStart: () => void;
};

export function PrepStage({ summary, onStart }: Props) {
  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.h1}>{summary.title}</h1>
        <p className={styles.sub}>Klar til at brygge.</p>
      </header>

      <div className={styles.card}>
        <div className={styles.row}>
          <span>Dose</span>
          <b>{summary.doseG} g</b>
        </div>
        <div className={styles.row}>
          <span>Vand</span>
          <b>{summary.waterG} g</b>
        </div>
        {summary.ratioLabel && (
          <div className={styles.row}>
            <span>Ratio</span>
            <b>{summary.ratioLabel}</b>
          </div>
        )}
        {typeof summary.estTotalSeconds === "number" && (
          <div className={styles.row}>
            <span>Est. tid</span>
            <b>{Math.round(summary.estTotalSeconds / 60)} min</b>
          </div>
        )}
      </div>

      <button className={styles.primary} onClick={onStart}>
        Start brew
      </button>
    </section>
  );
}
