"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./brew.module.css";

export type BrewStep = {
  id: string;
  label: string;
  instruction: string;
  targetG?: number;     // fx 50, 150, 300
  durationS?: number;   // fx 35
};

type Props = {
  title: string;            // "Coffee Brew — Kenya AA"
  steps: BrewStep[];
  startIndex?: number;
  onExit?: () => void;      // optional
  onFinish?: () => void;    // optional
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatMMSS(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

export default function BrewActive({
  title,
  steps,
  startIndex = 0,
  onExit,
  onFinish,
}: Props) {
  const [idx, setIdx] = useState(startIndex);
  const [running, setRunning] = useState(false);

  // timers
  const [totalMs, setTotalMs] = useState(0);
  const [stepMs, setStepMs] = useState(0);

  const step = steps[idx];
  const stepLimitMs = (step?.durationS || 0) * 1000;

  // RAF timer (smooth og stabilt)
  useEffect(() => {
    if (!running) return;

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const delta = now - last;
      last = now;

      setTotalMs((v) => v + delta);
      setStepMs((v) => v + delta);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // auto-advance på step tid (kun hvis durationS findes)
  useEffect(() => {
    if (!running) return;
    if (!stepLimitMs) return;
    if (stepMs < stepLimitMs) return;

    // vibrate (hvis mobil)
    try {
      if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    } catch {}

    if (idx < steps.length - 1) {
      setIdx((p) => p + 1);
      setStepMs(0);
    } else {
      setRunning(false);
      onFinish?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepMs, stepLimitMs, running]);

  // når step ændres manuelt: nulstil step timer
  useEffect(() => {
    setStepMs(0);
    setRunning(false);
  }, [idx]);

  const canPrev = idx > 0;
  const canNext = idx < steps.length - 1;

  const progress01 = useMemo(() => {
    if (!stepLimitMs) return (idx + 1) / steps.length; // fallback
    return Math.min(1, Math.max(0, stepMs / stepLimitMs));
  }, [stepLimitMs, stepMs, idx, steps.length]);

  const deg = Math.round(progress01 * 360);

  const topRight = `${idx + 1}/${steps.length}`;
  const bigValue = step?.targetG ? `${step.targetG}g` : "—";

  const remaining = stepLimitMs ? Math.max(0, stepLimitMs - stepMs) : 0;

  return (
    <main className={styles.brewPage}>
      {/* Top bar */}
      <header className={styles.brewTop}>
        <button
          className={styles.iconBtn}
          onClick={() => (onExit ? onExit() : history.back())}
          aria-label="Luk"
          type="button"
        >
          ✕
        </button>

        <div className={styles.topCenter}>
          <div className={styles.topKicker}>BREW MODE</div>
          <div className={styles.topTitle} title={title}>{title}</div>
        </div>

        <div className={styles.topRight}>{topRight}</div>
      </header>

      {/* Cockpit */}
      <section className={styles.cockpit}>
        <div className={styles.timer}>{formatMMSS(totalMs)}</div>

        <div className={styles.dialWrap}>
          <div
            className={styles.dial}
            style={{
              background: `conic-gradient(var(--accent1) 0deg ${deg}deg, rgba(255,255,255,.10) ${deg}deg 360deg)`,
            }}
            aria-label="Progress"
          >
            <div className={styles.dialInner}>
              <div className={styles.dialBig}>{bigValue}</div>

              <div className={styles.dialMeta}>
                <div className={styles.metaBlock}>
                  <div className={styles.metaLabel}>STEP</div>
                  <div className={styles.metaVal}>{step?.label || "—"}</div>
                </div>

                <div className={styles.metaDivider} />

                <div className={styles.metaBlock}>
                  <div className={styles.metaLabel}>LEFT</div>
                  <div className={styles.metaVal}>
                    {stepLimitMs ? `${Math.ceil(remaining / 1000)}s` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className={styles.instruction}>
          {step?.instruction || "—"}
        </p>

        <div className={styles.controls}>
          <button
            className={styles.ctrlBtn}
            onClick={() => setIdx((p) => Math.max(0, p - 1))}
            disabled={!canPrev}
            aria-label="Forrige step"
            type="button"
          >
            ‹
          </button>

          <button
            className={styles.ctrlMain}
            onClick={() => setRunning((v) => !v)}
            aria-label={running ? "Pause" : "Start"}
            type="button"
          >
            {running ? "Pause" : "Start"}
          </button>

          <button
            className={styles.ctrlBtn}
            onClick={() => setIdx((p) => Math.min(steps.length - 1, p + 1))}
            disabled={!canNext}
            aria-label="Næste step"
            type="button"
          >
            ›
          </button>
        </div>

        <div className={styles.dots} aria-label="Steps">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={i === idx ? styles.dotActive : styles.dot}
              onClick={() => setIdx(i)}
              aria-label={`Gå til ${s.label}`}
            />
          ))}
        </div>
      </section>
    </main>
  );
}