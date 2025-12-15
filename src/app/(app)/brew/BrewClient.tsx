"use client";

import { useMemo, useState, useEffect } from "react";
import styles from "./BrewClient.module.css";

type Step = {
  id: string;
  label: string;
  instruction: string;
  targetG?: number;
  seconds?: number;
};

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTenth(ms: number) {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

export default function BrewClient({ type, slug }: { type: string; slug: string }) {
  const title = useMemo(() => {
    const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
    return type === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
  }, [type, slug]);

  // v2: stadig hardcoded flow – men UI matcher “rigtig bryg”
  const steps: Step[] = useMemo(
    () => [
      { id: "prep", label: "Prep", instruction: "Skyl filter + varm server/kop. Nulstil vægt.", seconds: 20 },
      { id: "bloom", label: "Bloom", instruction: "Hæld til alle grunde er mættede.", targetG: 50, seconds: 35 },
      { id: "pour1", label: "Pour 1", instruction: "Hæld stabilt i cirkler. Hold flowet roligt.", targetG: 150, seconds: 40 },
      { id: "pour2", label: "Pour 2", instruction: "Top op til slutvægt. Stop og lad dræne færdigt.", targetG: 300, seconds: 55 },
      { id: "finish", label: "Finish", instruction: "Ryst let / swirl. Smag og log resultat.", seconds: 25 },
    ],
    []
  );

  const totalSeconds = useMemo(() => steps.reduce((acc, s) => acc + (s.seconds || 0), 0), [steps]);

  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [ms, setMs] = useState(0);
  const [showSteps, setShowSteps] = useState(false);

  const current = steps[idx];

  // v2: rigtig timer (ikke vægt-sensor endnu, men UI er “klar” til det)
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setMs((v) => v + 100), 100);
    return () => clearInterval(t);
  }, [running]);

  // Progress ring: hvis step har seconds => brug elapsed i step,
  // ellers brug “progress pr. step” så ringen altid føles levende.
  const stepSeconds = current.seconds || 0;
  const stepProgress = stepSeconds > 0 ? Math.min(1, (ms / 1000) / stepSeconds) : (idx + 1) / steps.length;

  // “Weight progress” mock: fyld op til targetG (kun til UI). 0..1
  const target = current.targetG || 0;
  const weightProgress = target ? Math.min(1, stepProgress) : 0;
  const shownWeight = target ? Math.round(target * weightProgress) : 0;

  const ringDeg = Math.round(weightProgress * 360);

  const goPrev = () => setIdx((p) => Math.max(0, p - 1));
  const goNext = () => setIdx((p) => Math.min(steps.length - 1, p + 1));

  // Når man skifter step: reset step-timer for at føles som en rigtig guide
  useEffect(() => {
    setMs(0);
    setRunning(false);
  }, [idx]);

  return (
    <main className={styles.page}>
      {/* top bar (minimal) */}
      <header className={styles.topBar}>
        <a className={styles.iconBtn} href={slug ? `/coffees/${encodeURIComponent(slug)}` : "/"} aria-label="Tilbage">
          ‹
        </a>

        <div className={styles.topCenter}>
          <div className={styles.kicker}>BREW MODE</div>
          <div className={styles.h1} title={title}>{title}</div>
        </div>

        <button className={styles.iconBtn} onClick={() => history.back()} aria-label="Luk">
          ✕
        </button>
      </header>

      {/* main “one screen” stage */}
      <section className={styles.stage} aria-label="Brew stage">
        {/* timer */}
        <div className={styles.timerRow}>
          <div className={styles.timer}>{formatTenth(ms)}</div>
          <button className={styles.stepsPill} onClick={() => setShowSteps(true)} type="button">
            {idx + 1}/{steps.length} · {current.label}
          </button>
        </div>

        {/* dial */}
        <div className={styles.dialWrap}>
          <div className={styles.dialOuter}>
            <div
              className={styles.dialRing}
              style={{
                background: `conic-gradient(var(--accent1) 0deg ${ringDeg}deg, rgba(255,255,255,.10) ${ringDeg}deg 360deg)`,
              }}
            />
            <div className={styles.dialInner}>
              <div className={styles.weightBig}>
                {target ? `${shownWeight.toLocaleString("da-DK")},0 g` : "—"}
              </div>

              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>WEIGHT</div>
                  <div className={styles.metricVal}>
                    {target ? `${shownWeight.toLocaleString("da-DK")},0 g` : "—"}
                  </div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>FLOW RATE</div>
                  <div className={styles.metricVal}>0 g/s</div>
                </div>
              </div>
            </div>
          </div>

          {/* small action bubble (placeholder for “pour mode” etc.) */}
          <button className={styles.fab} type="button" aria-label="Brew tools">
            ⏱
          </button>
        </div>

        {/* instruction */}
        <div className={styles.instruction}>
          {current.targetG
            ? `Hæld ${current.targetG}g vand – ${current.instruction}`
            : current.instruction}
        </div>

        {/* dots */}
        <div className={styles.dots} aria-label="Step progress">
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

        {/* controls pinned */}
        <div className={styles.controlsDock}>
          <div className={styles.controls}>
            <button className={styles.ctrlBtn} onClick={goPrev} disabled={idx === 0} type="button" aria-label="Forrige">
              ‹
            </button>

            <button
              className={styles.ctrlBtnCenter}
              onClick={() => setRunning((v) => !v)}
              type="button"
              aria-label={running ? "Pause" : "Start"}
            >
              {running ? "Ⅱ" : "▶"}
            </button>

            <button className={styles.ctrlBtn} onClick={goNext} disabled={idx === steps.length - 1} type="button" aria-label="Næste">
              ›
            </button>
          </div>

          <div className={styles.metaRow}>
            <span>Total {formatMMSS(totalSeconds)}</span>
            <button className={styles.linkBtn} onClick={() => setShowSteps(true)} type="button">
              Alle steps
            </button>
          </div>
        </div>
      </section>

      {/* bottom sheet for steps (so you keep “no scroll” feel) */}
      <div className={showSteps ? styles.sheetBackdrop : styles.sheetBackdropHidden}