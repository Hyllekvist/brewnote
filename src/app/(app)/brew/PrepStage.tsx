"use client";

import styles from "./PrepStage.module.css";

type Props = {
  title?: string; // fx "Hario V60"
  coffeeG: number;
  waterG: number;
  grind?: string; // fx "Medium-fine"
  temperatureC?: number; // fx 94
  ratioLabel?: string; // fx "1:15"
  onStart: () => void;
  onClose?: () => void;
};

export function Prep({
  title = "Brew",
  coffeeG,
  waterG,
  grind = "Medium",
  temperatureC,
  ratioLabel,
  onStart,
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
        <div className={styles.hero}>
          <div className={styles.kicker}>PREPARE</div>
          <h1 className={styles.h1}>Klar til bryg?</h1>
          <p className={styles.sub}>
            Hold det simpelt: mål, temperatur, og en rolig hældning.
          </p>
        </div>

        <section className={styles.cardGrid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>COFFEE</div>
            <div className={styles.cardValue}>{coffeeG} g</div>
            <div className={styles.cardMeta}>{grind}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>WATER</div>
            <div className={styles.cardValue}>{waterG} g</div>
            <div className={styles.cardMeta}>
              {temperatureC != null ? `${temperatureC}°C` : "Varmt, ikke kogende"}
            </div>
          </div>

          <div className={styles.cardWide}>
            <div className={styles.row}>
              <div className={styles.pill}>
                <span className={styles.pillKey}>Ratio</span>
                <span className={styles.pillVal}>{ratioLabel ?? "—"}</span>
              </div>
              <div className={styles.pill}>
                <span className={styles.pillKey}>Filter</span>
                <span className={styles.pillVal}>Skyl + forvarm</span>
              </div>
              <div className={styles.pill}>
                <span className={styles.pillKey}>Kande</span>
                <span className={styles.pillVal}>Tara</span>
              </div>
            </div>

            <div className={styles.tip}>
              Tip: Start roligt. Du vinder mere på stabilitet end “hurtighed”.
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <button className={styles.primary} onClick={onStart}>
          Start bryg
        </button>
        <div className={styles.footerHint}>Tryk for at gå direkte til Bloom.</div>
      </footer>
    </div>
  );
}
