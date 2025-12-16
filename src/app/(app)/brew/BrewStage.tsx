"use client";

import { useEffect, useMemo } from "react";
import styles from "./BrewStage.module.css";

export type BrewPhase = "bloom" | "pour" | "finish";

export type BrewStep = {
  id: string;
  label: string; // "Bloom", "Pour 1", "Finish"
  instruction: string; // kort tekst
  seconds?: number; // hvis step er tidsbaseret
  targetG?: number; // hvis step har mål
  phase: BrewPhase; // 👈 styrer ringens semantik
};

type Props = {
  steps: BrewStep[];
  activeIndex: number;
  elapsedSeconds: number;
  isRunning: boolean;

  onTick: () => void; // +1 sekund
  onAutoAdvanceIfNeeded: () => void; // skift step når tid nås
  onFinish: () => void; // når sidste step er done

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

  const stepProgress = useMemo(() => {
    if (!step?.seconds) return 0;
    const stepStart = steps
      .slice(0, activeIndex)
      .reduce((acc, s) => acc + (s.seconds ?? 0), 0);
    const inStep = elapsedSeconds - stepStart;
    return Math.min(1, Math.max(0, inStep / step.seconds));
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

  const centerText =
    stepRemaining != null ? formatMMSS(stepRemaining) : formatMMSS(elapsedSeconds);

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
        <BrewRing phase={step.phase} progress={stepProgress} centerText={centerText} />
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

      <p className={styles.hint}>{onTap ? "Tap for at springe til næste step." : ""}</p>
    </section>
  );
}

function BrewRing({
  phase,
  progress,
  centerText,
}: {
  phase: BrewPhase;
  progress: number; // 0 → 1
  centerText: string;
}) {
  const deg = Math.round(progress * 360);

  return (
    <div
      className={`${styles.ring} ${styles[`phase_${phase}`]}`}
      style={{
        background: `conic-gradient(
          var(--ringActive) 0deg ${deg}deg,
          rgba(255,255,255,0.10) ${deg}deg 360deg
        )`,
      }}
    >
      <div className={styles.ringInner}>
        <div className={styles.center}>{centerText}</div>
      </div>
    </div>
  );
}
