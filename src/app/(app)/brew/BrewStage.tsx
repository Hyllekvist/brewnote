"use client";

import { useEffect, useMemo } from "react";
import styles from "./BrewStage.module.css";

export type BrewPhase = "bloom" | "pour" | "finish";

export type BrewStep = {
  id: string;
  label: string;          // "Bloom", "Pour 1", "Finish"
  instruction: string;    // kort tekst
  seconds?: number;       // hvis step er tidsbaseret
  targetG?: number;       // hvis step har mål
  phase: BrewPhase;       // 👈 styrer ringens semantik
};

type Props = {
  steps: BrewStep[];
  activeIndex: number;
  elapsedSeconds: number;
  isRunning: boolean;

  // handlers (du flytter din nuværende logik ind her)
  onTick: () => void;                 // +1 sekund
  onAutoAdvanceIfNeeded: () => void;  // skift step når tid nås
  onFinish: () => void;               // når sidste step er done

  // optional gesture: tap-to-skip (ikke knap)
  onTap?: () => void;
};

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function BrewStage({
  steps,
  activeIndex,
  elapsedSeconds,
  isRunning,
  onTick,
  onAutoAdvanceIfNeeded,
  onFinish,
  onTap,
}: Props) {
  const step = steps[activeIndex];

  const stepRemaining = useMemo(() => {
    if (!step?.seconds) return null;
    const stepStart = steps
      .slice(0, activeIndex)
      .reduce((acc, s) => acc + (s.seconds ?? 0), 0);
    const inStep = elapsedSeconds - stepStart;
    return Math.max(0, step.seconds - inStep);
  }, [steps, activeIndex, elapsedSeconds, step]);

  // tick
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => onTick(), 1000);
    return () => clearInterval(t);
  }, [isRunning, onTick]);

  // auto advance / finish
  useEffect(() => {
    if (!isRunning) return;

    // sidste step slut?
    const totalPlanned = steps.reduce((acc, s) => acc + (s.seconds ?? 0), 0);
    if (totalPlanned > 0 && elapsedSeconds >= totalPlanned) {
      onFinish();
      return;
    }

    onAutoAdvanceIfNeeded();
  }, [isRunning, elapsedSeconds, steps, onAutoAdvanceIfNeeded, onFinish]);

  if (!step) return null;

  return (
    <section
      className={styles.root}
      onClick={() => onTap?.()}
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
    >
      <header className={styles.header}>
        <h2 className={styles.kicker}>{step.label}</h2>
        <p className={styles.instruction}>{step.instruction}</p>
      </header>

      <div className={styles.ringWrap}>
        <BrewRing
          phase={step.phase}
          secondsRemaining={stepRemaining ?? undefined}
          centerText={stepRemaining != null ? formatMMSS(stepRemaining) : formatMMSS(elapsedSeconds)}
        />
      </div>

      <div className={styles.meta}>
        {typeof step.targetG === "number" && (
          <div className={styles.metaPill}>
            Target: <b>{step.targetG} g</b>
          </div>
        )}
        <div className={styles.metaPill}>
          Step {activeIndex + 1}/{steps.length}
        </div>
      </div>

      <p className={styles.hint}>
        {onTap ? "Tap for at springe til næste step." : ""}
      </p>
    </section>
  );
}

function BrewRing({
  phase,
  secondsRemaining,
  centerText,
}: {
  phase: BrewPhase;
  secondsRemaining?: number;
  centerText: string;
}) {
  // Render: simpelt skelet. Du kan senere lave SVG ring.
  return (
    <div className={`${styles.ring} ${styles[`phase_${phase}`]}`}>
      <div className={styles.center}>{centerText}</div>
      {typeof secondsRemaining === "number" && (
        <div className={styles.sub}>remaining</div>
      )}
    </div>
  );
}
