"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  /* ---------- TITLE ---------- */

  const title = useMemo(() => {
    const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
    return type === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
  }, [type, slug]);

  /* ---------- STEPS (v2 hardcoded) ---------- */

  const steps: Step[] = useMemo(
    () => [
      { id: "prep", label: "Prep", instruction: "Skyl filter og varm kop/server. Nulstil vægten.", seconds: 20 },
      { id: "bloom", label: "Bloom", instruction: "Hæld jævnt til alle grunde er mættede.", targetG: 50, seconds: 35 },
      { id: "pour1", label: "Pour 1", instruction: "Hæld stabilt i cirkler. Roligt flow.", targetG: 150, seconds: 40 },
      { id: "pour2", label: "Pour 2", instruction: "Top op til slutvægt. Stop og lad dræne.", targetG: 300, seconds: 55 },
      { id: "finish", label: "Finish", instruction: "Swirl let. Smag og log resultat.", seconds: 25 },
    ],
    []
  );

  const totalSeconds = useMemo(
    () => steps.reduce((acc, s) => acc + (s.seconds || 0), 0),
    [steps]
  );

  /* ---------- STATE ---------- */

  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [elapsed, setElapsed] = useState(0); // total sek
  const [stepElapsed, setStepElapsed] = useState(0); // step sek

  const current = steps[idx];
  const isLast = idx === steps.length - 1;

  /* ---------- TIMER ---------- */

  useEffect(() => {
    if (!running) return;

    const t = window.setInterval(() => {
      setElapsed((p) => p + 1);
      setStepElapsed((p) => p + 1);
    }, 1000);

    return () => window.clearInterval(t);
  }, [running]);

  /* ---------- AUTO ADVANCE ---------- */

  useEffect(() => {
    const limit = current.seconds || 0;
    if (!running || !limit) return;
    if (stepElapsed < limit) return;

    // vibrate hvis mobil
    try {
      navigator.vibrate?.([40, 40, 40]);
    } catch {}

    // sidste step: stop og send til review
    if (isLast) {
      setRunning(false);

      const qs = new URLSearchParams({
        type,
        slug,
        seconds: String(elapsed),
        method: "Pour-over",
      });

      router.push(`/brew/review?${qs.toString()}`);
      return;
    }

    // ellers: næste step (behold running=true så flow fortsætter)
    setIdx((p) => Math.min(steps.length - 1, p + 1));
    setStepElapsed(0);
  }, [stepElapsed, running, current.seconds, isLast, elapsed, slug, type, router, steps.length]);

  /* ---------- når idx ændres manuelt ---------- */
  useEffect(() => {
    setStepElapsed(0);
  }, [idx]);

  /* ---------- MANUAL NAV ---------- */

  const goPrev = () => {
    setRunning(false);
    setIdx((p) => Math.max(0, p - 1));
  };

  const goNext = () => {
    setRunning(false);
    setIdx((p) => Math.min(steps.length - 1, p + 1));
  };

  /* ---------- PROGRESS ---------- */

  const stepSeconds = current.seconds || 0;
  const stepProgress = stepSeconds ? Math.min(1, stepElapsed / stepSeconds) : 0.12;
  const progressDeg = Math.round(stepProgress * 360);

  const primaryValue = current.targetG ? `${current.targetG}g` : isLast ? "Done" : "—";

  /* ---------- COMMAND TEXT ---------- */

  const actionLine = useMemo(() => {
    if (current.id === "prep") return "Prep – gør klar og nulstil vægten.";
    if (current.id === "finish") return "Finish – swirl og smag.";
    if (current.targetG) return `Pour til ${current.targetG}g.`;
    return current.instruction;
  }, [current]);

  /* ---------- PRIMARY BUTTON ---------- */

  const primaryLabel = isLast && !running ? "Review" : running ? "Pause" : "Start";

  const onPrimary = () => {
    // sidste step + ikke kørende = gå til review direkte
    if (isLast && !running) {
      const qs = new URLSearchParams({
        type,
        slug,
        seconds: String(elapsed),
        method: "Pour-over",
      });
      router.push(`/brew/review?${qs.toString()}`);
      return;
    }
    setRunning((v) => !v);
  };

  /* ---------- RENDER ---------- */

  return (
    <main className={styles.page}>
      {/* TOP BAR */}
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

      {/* COCKPIT */}
      <section className={styles.cockpit}>
        <div className={styles.timerRow}>
          <div className={styles.timer}>{formatMMSS(elapsed)}</div>

          <button className={styles.stepPill} onClick={() => setSheetOpen((v) => !v)} aria-expanded={sheetOpen}>
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
              background: `conic-gradient(var(--accent1) 0deg ${progressDeg}deg, rgba(255,255,255,.10) ${progressDeg}deg 360deg)`,
            }}
          >
            <div className={styles.ringInner}>
              <div className={styles.bigNumber}>{primaryValue}</div>
            </div>
          </div>
        </div>

        <p className={styles.instruction}>
          <strong>{actionLine}</strong>
          <br />
          <span className={styles.subInstruction}>{current.instruction}</span>
        </p>

        <div className={styles.controls}>
          <button className={styles.btn} onClick={goPrev} disabled={idx === 0}>
            ←
          </button>

          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onPrimary}>
            {primaryLabel}
          </button>

          <button className={styles.btn} onClick={goNext} disabled={isLast}>
            →
          </button>
        </div>

        <div className={styles.microRow}>
          <span>
            Step tilbage:{" "}
            <strong>{stepSeconds ? formatMMSS(Math.max(0, stepSeconds - stepElapsed)) : "—"}</strong>
          </span>
          <span>
            Total: <strong>{formatMMSS(totalSeconds)}</strong>
          </span>
        </div>
      </section>

      {/* BOTTOM SHEET */}
      <section className={`${styles.sheet} ${sheetOpen ? styles.sheetOpen : ""}`}>
        <div className={styles.sheetHandle} onClick={() => setSheetOpen((v) => !v)} />

        <div className={styles.stepList}>
          {steps.map((s, i) => (
            <button
              key={s.id}
              className={`${styles.stepRow} ${i === idx ? styles.stepRowActive : ""}`}
              onClick={() => {
                setRunning(false);
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
      </section>
    </main>
  );
}