"use client";

import styles from "./FinishStage.module.css";

type Props = {
  totalTimeSeconds?: number;
  coffeeG?: number;
  waterG?: number;
  onBrewAgain: () => void;
  onSave?: () => void;
};

function formatMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FinishStage({
  totalTimeSeconds,
  coffeeG,
  waterG,
  onBrewAgain,
  onSave,
}: Props) {
  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <div className={styles.badge}>FINISH</div>
        <h1 className={styles.h1}>Done</h1>

        <div className={styles.stats}>
          <div>
            <span>TID</span>
            <strong>{totalTimeSeconds ? formatMMSS(totalTimeSeconds) : "—"}</strong>
          </div>
          <div>
            <span>KAFFE</span>
            <strong>{coffeeG ?? "—"} g</strong>
          </div>
          <div>
            <span>VAND</span>
            <strong>{waterG ?? "—"} g</strong>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <button className={styles.primary} onClick={onBrewAgain}>
          Bryg igen
        </button>
        {onSave && (
          <button className={styles.secondary} onClick={onSave}>
            Gem
          </button>
        )}
      </footer>
    </div>
  );
}
