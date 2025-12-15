"use client";

import { useMemo, useState } from "react";
import styles from "./BrewClient.module.css";

type Step = {
  id: string;
  label: string;
  instruction: string;
  targetG?: number; // mål-vægt
  seconds?: number; // step-længde
};

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function BrewClient({ type, slug }: { type: string; slug: string }) {
  const title = useMemo(() => {
    const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
    return type === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
  }, [type, slug]);

  // v1: hardcodet “Pour-over” flow (Supabase senere)
  const steps: Step[] = useMemo(
    () => [
      {
        id: "prep",
        label: "Prep",
        instruction: "Skyl filter + varm server/kop. Nulstil vægt.",
        seconds: 20,
      },
      {
        id: "bloom",
        label: "Bloom",
        instruction: "Hæld til alle grunde er mættede.",
        targetG: 50,
        seconds: 35,
      },
      {
        id: "pour1",
        label: "Pour 1",
        instruction: "Hæld stabilt i cirkler. Hold flowet roligt.",
        targetG: 150,
        seconds: 40,
      },
      {
        id: "pour2",
        label: "Pour 2",
        instruction: "Top op til slutvægt. Stop og lad dræne færdigt.",
        targetG: 300,
        seconds: 55,
      },
      {
        id: "finish",
        label: "Finish",
        instruction: "Ryst let / swirl. Smag og log resultat.",
        seconds: 25,
      },
    ],
    []
  );

  const totalSeconds = useMemo(
    () => steps.reduce((acc, s) => acc + (s.seconds || 0), 0),
    [steps]
  );

  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);

  // v1 “fake” progress (uden realtime timer) – vi holder UI 10/10 nu
  // Næste step: rigtigt interval + vibration + Live Activity.
  const current = steps[idx];
  const progress = Math.round(((idx + 1) / steps.length) * 100);

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <a className={styles.back} href={slug ? `/coffees/${encodeURIComponent(slug)}` : "/"} aria-label="Tilbage">
          ←
        </a>
        <div className={styles.topTitle}>
          <div className={styles.kicker}>BREW MODE</div>
          <div className={styles.h1}>{title}</div>
        </div>
        <button className={styles.close} onClick={() => history.back()} aria-label="Luk">
          ✕
        </button>
      </header>

      {/* Hero device card */}
      <section className={styles.deviceCard}>
        <div className={styles.ringWrap}>
          <div
            className={styles.ring}
            style={{
              background: `conic-gradient(var(--ok) 0deg ${progress * 3.6}deg, rgba(255,255,255,.10) ${progress * 3.6}deg 360deg)`,
            }}
          >
            <div className={styles.ringInner}>
              <div className={styles.bigNumber}>
                {current.targetG ? `${current.targetG}g` : "—"}
              </div>
              <div className={styles.metrics}>
                <div>
                  <span className={styles.metricLabel}>WEIGHT</span>
                  <span className={styles.metricVal}>{current.targetG ? `${current.targetG}g` : "—"}</span>
                </div>
                <div>
                  <span className={styles.metricLabel}>FLOW RATE</span>
                  <span className={styles.metricVal}>3.5g/s</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.stepPill}>
            <span className={styles.stepIndex}>{idx + 1}/{steps.length}</span>
            <span className={styles.stepLabel}>{current.label}</span>
          </div>
        </div>

        <p className={styles.instruction}>{current.instruction}</p>

        <div className={styles.controls}>
          <button
            className={styles.secondaryBtn}
            onClick={() => setIdx((p) => Math.max(0, p - 1))}
            disabled={idx === 0}
          >
            ← Forrige
          </button>

          <button
            className={styles.primaryBtn}
            onClick={() => setRunning((v) => !v)}
          >
            {running ? "Pause" : "Start"}
          </button>

          <button
            className={styles.secondaryBtn}
            onClick={() => setIdx((p) => Math.min(steps.length - 1, p + 1))}
            disabled={idx === steps.length - 1}
          >
            Næste →
          </button>
        </div>
      </section>

      {/* Step list */}
      <section className={styles.steps}>
        <div className={styles.stepsHeader}>
          <div className={styles.stepsTitle}>Steps</div>
          <div className={styles.stepsMeta}>Total {formatMMSS(totalSeconds)}</div>
        </div>

        <div className={styles.stepList}>
          {steps.map((s, i) => (
            <button
              key={s.id}
              className={i === idx ? styles.stepRowActive : styles.stepRow}
              onClick={() => setIdx(i)}
            >
              <div className={styles.stepLeft}>
                <div className={styles.bullet}>{i + 1}</div>
                <div>
                  <div className={styles.rowTitle}>{s.label}</div>
                  <div className={styles.rowSub}>{s.targetG ? `${s.targetG}g` : "—"} · {s.seconds ? `${s.seconds}s` : "—"}</div>
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