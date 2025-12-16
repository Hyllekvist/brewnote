"use client";

import styles from "./FinishStage.module.css";

type Props = {
  title?: string; // fx "Hario V60"
  totalTimeSeconds?: number; // hvis du tracker samlet tid
  coffeeG?: number;
  waterG?: number;
  notes?: string;
  onBrewAgain: () => void;
  onSave?: () => void;
  onClose?: () => void;
};

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Finish({
  title = "Brew",
  totalTimeSeconds,
  coffeeG,
  waterG,
  notes,
  onBrewAgain,
  onSave,
  onClose,
}: Props) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button className={styles.iconBtn} onClick={() => onClose?.()} aria-label="Luk">
          ✕
        </button>
        <div className={styles.title}>{title}</div>
        <div className={styles.spacer} />
      </header>

      <main className={styles.main}>
        <div className={styles.badge}>FINISH</div>
        <h1 className={styles.h1}>Done.</h1>
        <p className={styles.sub}>Smag først. Justér bagefter.</p>

        <section className={styles.summary}>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>TOTAL TID</div>
            <div className={styles.metricValue}>
              {totalTimeSeconds != null ? formatMMSS(totalTimeSeconds) : "—"}
            </div>
          </div>

          <div className={styles.metric}>
            <div className={styles.metricLabel}>DOSE</div>
            <div className={styles.metricValue}>
              {coffeeG != null ? `${coffeeG} g` : "—"}
            </div>
          </div>

          <div className={styles.metric}>
            <div className={styles.metricLabel}>WATER</div>
            <div className={styles.metricValue}>
              {waterG != null ? `${waterG} g` : "—"}
            </div>
          </div>
        </section>

        <section className={styles.noteCard}>
          <div className={styles.noteTitle}>Hurtig note</div>
          <div className={styles.noteBody}>
            {notes ?? "Skriv 1 ting: var den for bitter, for tynd, eller spot on?"}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <button className={styles.primary} onClick={onBrewAgain}>
          Bryg igen
        </button>

        {onSave ? (
          <button className={styles.secondary} onClick={onSave}>
            Gem bryg
          </button>
        ) : null}
      </footer>
    </div>
  );
}
