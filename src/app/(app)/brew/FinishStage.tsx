"use client";

import styles from "./FinishStage.module.css";

type Props = {
  title?: string;
  onSave: () => void;
};

export function FinishStage({ title = "Brew complete", onSave }: Props) {
  return (
    <section className={styles.root}>
      <h2 className={styles.h2}>{title}</h2>
      <p className={styles.sub}>Gem din brygning og gå til review.</p>

      <button className={styles.primary} onClick={onSave}>
        Save brew
      </button>
    </section>
  );
}
