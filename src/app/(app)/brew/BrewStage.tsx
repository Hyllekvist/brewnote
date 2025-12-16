"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./BrewStage.module.css";

export type BrewPhase = "bloom" | "pour" | "finish";

export type BrewStep = {
  id: string;
  label: string; // "Bloom", "Pour 1", "Finish"
  instruction: string; // kort tekst
  seconds?: number; // tidsbaseret step
  targetG?: number; // hvis step har mål
  phase: BrewPhase; // styrer semantik/visuel
};

type Props = {
  steps: BrewStep[];
  activeIndex: number;
  elapsedSeconds: number;
  isRunning: boolean;

  onTick: () => void; // +1 sekund
  onAutoAdvanceIfNeeded: () => void; // skift step når tid nås
  onFinish: () => void; // når sidste step er done

  // gesture: tap-to-skip (ikke knap)
  onTap?: () => void;

  // optional: tilbage/skip til forrige (gesture/knap andetsteds)
  onBack?: () => void;

  className?: string;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function phaseLabel(phase: BrewPhase) {
  if (phase === "bloom") return "BLOOM";
  if (phase === "pour") return "POUR";
  return "FINISH";
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
  onBack,
  className,
}: Props) {
  const step = steps[activeIndex];
  const totalSeconds = step?.seconds ?? 0;

  const isLast = activeIndex === steps.length - 1;
  const isTimed = Boolean(step?.seconds && step.seconds > 0);

  // ---------- Smooth visual time (interpolates between 1s ticks) ----------
  const [visualElapsed, setVisualElapsed] = useState<number>(elapsedSeconds);
  const rafRef = useRef<number | null>(null);
  const baseRef = useRef<number>(elapsedSeconds);
  const startMsRef = useRef<number>(0);

  // Reset visual timer when elapsedSeconds jumps (new step / reset / etc.)
  useEffect(() => {
    baseRef.current = elapsedSeconds;
    setVisualElapsed(elapsedSeconds);
    startMsRef.current = performance.now();
  }, [elapsedSeconds, activeIndex]);

  // Run RAF while running (but only needed for timed steps)
  useEffect(() => {
    if (!isRunning || !isTimed) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // keep it snapped to real elapsed
      setVisualElapsed(elapsedSeconds);
      return;
    }

    startMsRef.current = performance.now();

    const loop = () => {
      const now = performance.now();
      const delta = (now - startMsRef.current) / 1000;

      // Visual should move smoothly from last whole second tick:
      const next = baseRef.current + delta;

      // Never exceed totalSeconds
      setVisualElapsed(Math.min(next, totalSeconds));

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isRunning, isTimed, elapsedSeconds, totalSeconds]);

  // progress kun når timed (use visualElapsed for smooth ring)
  const progress = useMemo(() => {
    if (!isTimed) return 0;
    return clamp01(visualElapsed / (totalSeconds || 1));
  }, [visualElapsed, isTimed, totalSeconds]);

  // tick loop (1s) - uændret
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => {
      onTick();
    }, 1000);
    return () => clearInterval(t);
  }, [isRunning, onTick]);

  // auto-advance (efter tick) - uændret
  useEffect(() => {
    if (!isRunning) return;
    onAutoAdvanceIfNeeded();
  }, [elapsedSeconds, isRunning, onAutoAdvanceIfNeeded]);

  // finish hook (hvis sidste step og nået tid) - uændret (baseret på real elapsedSeconds)
  useEffect(() => {
    if (!isRunning) return;
    if (!isLast) return;
    if (!isTimed) return;
    if (elapsedSeconds >= totalSeconds) onFinish();
  }, [elapsedSeconds, isLast, isRunning, isTimed, onFinish, totalSeconds]);

  // Tap-to-skip: hele stage er tappable (men kun hvis handler findes)
  const canTap = Boolean(onTap);

  // Keyboard: Space/Enter til tap, Backspace til back
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !canTap) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && onTap) {
        e.preventDefault();
        onTap();
      }
      if (e.key === "Backspace" && onBack) {
        e.preventDefault();
        onBack();
      }
    };

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [canTap, onBack, onTap]);

  const phase = step?.phase ?? "pour";

  // countdown text: brug real elapsedSeconds så tallet skifter pr sekund (læsbart)
  const remaining = isTimed ? Math.max(0, totalSeconds - elapsedSeconds) : elapsedSeconds;

  return (
    <div
      ref={rootRef}
      className={[
        styles.root,
        styles[`phase_${phase}`],
        canTap ? styles.tappable : "",
        className || "",
      ].join(" ")}
      tabIndex={canTap ? 0 : -1}
      role={canTap ? "button" : undefined}
      aria-label={canTap ? "Tryk for næste step" : undefined}
      onClick={canTap ? onTap : undefined}
    >
      <header className={styles.header}>
        <div className={styles.meta}>
          <div className={styles.phase}>{phaseLabel(phase)}</div>
          <div className={styles.stepLabel}>{step?.label ?? ""}</div>
        </div>

        <div className={styles.rightMeta}>
          {typeof step?.targetG === "number" ? (
            <div className={styles.target}>
              <span className={styles.targetValue}>{step.targetG}</span>
              <span className={styles.targetUnit}>g</span>
            </div>
          ) : (
            <div className={styles.targetGhost} />
          )}
        </div>
      </header>

      <main className={styles.main}>
        <p className={styles.instruction}>{step?.instruction ?? ""}</p>

        <div className={styles.dialWrap} aria-hidden="true">
          <div className={styles.dialOuter}>
            <div className={styles.dialInner}>
              <div className={styles.time}>
                {isTimed ? formatMMSS(remaining) : formatMMSS(elapsedSeconds)}
              </div>
              <div className={styles.subline}>
                {isTimed ? "til næste step" : "kørsel"}
              </div>
            </div>

            {/* ring - smooth progress */}
            <div
              className={styles.ring}
              style={{
                ["--p" as any]: `${Math.round(progress * 100)}%`,
              }}
            />
          </div>
        </div>

        {canTap ? (
          <div className={styles.hint}>Tryk hvor som helst for næste step</div>
        ) : (
          <div className={styles.hintGhost} />
        )}
      </main>
    </div>
  );
}
