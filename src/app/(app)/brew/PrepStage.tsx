"use client"; 

import styles from "./PrepStage.module.css";

export type PrepSummary = {
  title: string;
  doseG: number;
  waterG: number;
  ratioLabel: string;
  estTotalSeconds: number;
};

type Props = {
  summary: PrepSummary;
  onStart: () => void;
  onClose?: () => void;
};

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PrepStage({ summary, onStart, onClose }: Props) {
  const { title, doseG, waterG, ratioLabel, estTotalSeconds } = summary;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button
          className={styles.iconBtn}
          onClick={() => onClose?.()}
          aria-label="Luk"
        >
          ✕
        </button>
        <div className={styles.title}>{title}</div>
        <div className={styles.spacer} />
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.kicker}>PREP</div>
          <h1 className={styles.h1}>Gør klar</h1>
          <p className={styles.sub}>Klar gear og vægt før du starter.</p>
        </div>

        <section className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>DOSE</div>
            <div className={styles.cardValue}>{doseG} g</div>
            <div className={styles.cardMeta}>Kaffe</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>WATER</div>
            <div className={styles.cardValue}>{waterG} g</div>
            <div className={styles.cardMeta}>Total</div>
          </div>

          <div className={styles.cardWide}>
            <div className={styles.row}>
              <div className={styles.pill}>
                <span className={styles.pillKey}>Ratio</span>
                <span className={styles.pillVal}>{ratioLabel}</span>
              </div>
              <div className={styles.pill}>
                <span className={styles.pillKey}>Est.</span>
                <span className={styles.pillVal}>
                  {formatMMSS(estTotalSeconds)}
                </span>
              </div>
              <div className={styles.pill}>
                <span className={styles.pillKey}>Filter</span>
                <span className={styles.pillVal}>Skyl + forvarm</span>
              </div>
              <div className={styles.pill}>
                <span className={styles.pillKey}>Vægt</span>
                <span className={styles.pillVal}>Tara</span>
              </div>
            </div>

            <div className={styles.tip}>
              Start roligt. Stabilitet &gt; hastighed.
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <button className={styles.primary} onClick={onStart}>
          Start bryg
        </button>
        <div className={styles.footerHint}>Starter ved Bloom.</div>
      </footer>
    </div>
  );
}
