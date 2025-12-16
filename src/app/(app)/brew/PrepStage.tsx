"use client";

import styles from "./PrepStage.module.css";

type Props = {
  title?: string;
  coffeeG: number;
  waterG: number;
  grind?: string;
  temperatureC?: number;
  ratioLabel?: string;
  onStart: () => void;
  onClose?: () => void;
};

export function PrepStage({
  title = "Hario V60",
  coffeeG,
  waterG,
  grind = "Medium-fine",
  temperatureC = 94,
  ratioLabel = "1:15",
  onStart,
  onClose,
}: Props) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button className={styles.iconBtn} onClick={onClose}>
          ✕
        </button>
        <div className={styles.title}>{title}</div>
        <div className={styles.spacer} />
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.kicker}>PREP</div>
          <h1 className={styles.h1}>Gør klar</h1>
          <p className={styles.sub}>Alt skal være klar før Bloom.</p>
        </div>

        <section className={styles.grid}>
          <div className={styles.card}>
            <span>KAFFE</span>
            <strong>{coffeeG} g</strong>
            <em>{grind}</em>
          </div>

          <div className={styles.card}>
            <span>VAND</span>
            <strong>{waterG} g</strong>
            <em>{temperatureC}°C</em>
          </div>

          <div className={styles.cardWide}>
            <div className={styles.pill}>Ratio {ratioLabel}</div>
            <div className={styles.pill}>Skyl filter</div>
            <div className={styles.pill}>Tara vægt</div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <button className={styles.primary} onClick={onStart}>
          Start bryg
        </button>
      </footer>
    </div>
  );
}
