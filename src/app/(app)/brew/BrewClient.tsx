"use client";

import { useEffect, useMemo, useState } from "react";
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
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function BrewClient({ type, slug }: { type: string; slug: string }) {
  const title = useMemo(() => {
    const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
    return type === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
  }, [type, slug]);

  // v2: stadig hardcoded, men UI/flow er “rigtigt”
  const steps: Step[] = useMemo(
    () => [
      { id: "prep", label: "Prep", instruction: "Skyl filter + varm server/kop. Nulstil vægt.", seconds: 20 },
      { id: "bloom", label: "Bloom", instruction: "Hæld 50g og mæt alle grunde jævnt.", targetG: 50, seconds: 35 },
      { id: "pour1", label: "Pour 1", instruction: "Hæld stabilt i cirkler. Hold flowet roligt.", targetG: 150, seconds: 40 },
      { id: "pour2", label: "Pour 2", instruction: "Top op til slutvægt. Stop og lad dræne færdigt.", targetG: 300, seconds: 55 },
      { id: "finish", label: "Finish", instruction: "Swirl let. Smag og log resultat.", seconds: 25 },
    ],
    []
  );

  const totalSeconds = useMemo(() => steps.reduce((acc, s) => acc + (s.seconds || 0), 0), [steps]);

  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // timer
  const [elapsed, setElapsed] = useState(0); // total
  const [stepElapsed, setStepElapsed] = useState(0); // current step

  const current = steps[idx];

  useEffect(() => {
    if (!running) return;

    const t = window.setInterval(() => {
      setElapsed((p) => p + 1);
      setStepElapsed((p) => p + 1);
    }, 1000);

    return () => window.clearInterval(t);
  }, [running]);

  // auto-advance når step timer er færdig
  useEffect(() => {
    const limit = current.seconds || 0;
    if (!running || !limit) return;
    if (stepElapsed < limit) return;

    // vibrate hvis mobil
    try {
      if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    } catch {}

    // næste step
    setIdx((p) => Math.min(steps.length - 1, p + 1));
    setStepElapsed(0);
  }, [stepElapsed, running, current.seconds, steps.length]);

  // når idx ændres manuelt
  useEffect(() => {
    setStepElapsed(0);
  }, [idx]);

  const stepSeconds = current.seconds || 0;
  const stepProgress = stepSeconds ? Math.min(1, stepElapsed / stepSeconds) : 0.12;

  const progressDeg = Math.round(stepProgress * 360);

  const primaryLabel = current.targetG ? `${current.targetG.toFixed(0)}g` : "—";
  const timerLabel = formatMMSS(elapsed);

  const canPrev = idx > 0;
  const canNext = idx < steps.length - 1;

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <a
          className={styles.iconBtn}
          href={slug ? `/coffees/${encodeURIComponent(slug)}` : "/"}
          aria-label="Tilbage"
        >
          ←
        </a>

        <div className={styles.topTitle}>
          <div className={styles.kicker}>BREW MODE</div>
          <div className={styles.h1} title={title}>
            {title}
          </div>
        </div>

        <button className={styles.iconBtn} onClick={() => history.back()} aria-label="Luk">
          ✕
        </button>
      </header>

      {/* “Over fold” cockpit */}
      <section className={styles.cockpit}>
        <div className={styles.timerRow}>
          <div className={styles.timer}>{timerLabel}</div>

          <button
            className={styles.stepPill}
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
          >
            <span className={styles.pillIdx}>
              {idx + 1}/{steps.length}
            </span>
            <span className={styles.pillLabel}>{current.label}</span>
            <span className={styles.pillChevron}>{sheetOpen ? "▾" : "▴"}</span>
          </button>
        </div>

        <div className={styles.ringWrap}>
          <div
            className={styles.ring}
            style={{
              background: `conic-gradient(var(--accentOk) 0deg ${progressDeg}deg, rgba(255,255,255,.10) ${progressDeg}deg 360deg)`,
            }}
          >
            <div className={styles.ringInner}>
              <div className={styles.bigNumber}>{primaryLabel}</div>

              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>WEIGHT</div>
                  <div className={styles.metricVal}>{primaryLabel}</div>
                </div>
                <div className={styles.metricDivider} />
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>FLOW RATE</div>
                  <div className={styles.metricVal}>3.5g/s</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className={styles.instruction}>{current.instruction}</p>

        <div className={styles.controls}>
          <button
            className={styles.btn}
            onClick={() => setIdx((p) => Math.max(0, p - 1))}
            disabled={!canPrev}
          >
            ←
          </button>

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setRunning((v) => !v)}
          >
            {running ? "Pause" : "Start"}
          </button>

          <button
            className={styles.btn}
            onClick={() => setIdx((p) => Math.min(steps.length - 1, p + 1))}
            disabled={!canNext}
          >
            →
          </button>
        </div>

        {/* micro status */}
        <div className={styles.microRow}>
          <span>
            Step: <strong>{stepSeconds ? formatMMSS(Math.max(0, stepSeconds - stepElapsed)) : "—"}</strong>
          </span>
          <span>
            Total: <strong>{formatMMSS(totalSeconds)}</strong>
          </span>
        </div>
      </section>

      {/* Bottom sheet steps */}
      <section className={`${styles.sheet} ${sheetOpen ? styles.sheetOpen : ""}`}>
        <div className={styles.sheetHandle} onClick={() => setSheetOpen((v) => !v)} role="button" tabIndex={0} />
        <div className={styles.sheetHead}>
          <div className={styles.sheetTitle}>Steps</div>
          <div className={styles.sheetMeta}>Total {formatMMSS(totalSeconds)}</div>
        </div>

        <div className={styles.stepList}>
          {steps.map((s, i) => (
            <button
              key={s.id}
              className={`${styles.stepRow} ${i === idx ? styles.stepRowActive : ""}`}
              onClick={() => {
                setIdx(i);
                setSheetOpen(false);
              }}
            >
              <div className={styles.stepLeft}>
                <div className={styles.bullet}>{i + 1}</div>
                <div>
                  <div className={styles.rowTitle}>{s.label}</div>
                  <div className={styles.rowSub}>
                    {s.targetG ? `${s.targetG}g` : "—"} · {s.seconds ? `${s.seconds}s` : "—"}
                  </div>
                </div>
              </div>
              <div className={styles.chev}>›</div>
            </button>
          ))}
        </div>

        <div className={styles.bottomActions}>
          <button className={styles.flatBtn}>Log resultat</button>
          <button className={styles.flatBtn}>Gem som preset</button>
        </div>
      </section>
    </main>
  );
}