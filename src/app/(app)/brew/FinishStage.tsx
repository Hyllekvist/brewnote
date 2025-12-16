"use client";

import styles from "./FinishStage.module.css";

type Props = {
  title?: string;          // <- FIX: BrewClient bruger title
  subtitle?: string;       // optional
  onSave?: () => void;     // <- FIX: BrewClient bruger onSave
  onDone?: () => void;     // optional (hvis du vil kunne lukke flow)
  onBrewAgain?: () => void; // optional
};

export function FinishStage({
  title = "Brew complete",
  subtitle = "Done. Smag først. Justér bagefter.",
  onSave,
  onDone,
  onBrewAgain,
}: Props) {
  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <div className={styles.badge}>FINISH</div>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.sub}>{subtitle}</p>
      </main>

      <footer className={styles.footer}>
        {onBrewAgain ? (
          <button className={styles.secondary} onClick={onBrewAgain}>
            Bryg igen
          </button>
        ) : null}

        {onSave ? (
          <button className={styles.primary} onClick={onSave}>
            Gem bryg
          </button>
        ) : onDone ? (
          <button className={styles.primary} onClick={onDone}>
            Done
          </button>
        ) : (
          <button className={styles.primary} onClick={() => {}}>
            Done
          </button>
        )}
      </footer>
    </div>
  );
}
