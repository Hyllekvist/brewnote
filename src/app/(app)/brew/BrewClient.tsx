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

type Slide = {
  id: string;
  title: string;
  body: string;
  icon: "tools" | "dripper" | "coffee" | "kettle";
};

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function SlideIcon({ kind }: { kind: Slide["icon"] }) {
  // Simple inline icons (kan skiftes senere)
  if (kind === "tools") {
    return (
      <svg width="84" height="84" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M14 3h-4v2H8a2 2 0 0 0-2 2v2h12V7a2 2 0 0 0-2-2h-2V3Zm6 8H4v2h16v-2Zm-3 4H7v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6Z"
        />
      </svg>
    );
  }
  if (kind === "dripper") {
    return (
      <svg width="84" height="84" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M7 3h10l-1 7h-1v2a4 4 0 0 1-8 0V10H8L7 3Zm2.2 2 0.6 4h4.4l0.6-4H9.2ZM9 12v0.3a3 3 0 0 0 6 0V12H9Z"
        />
      </svg>
    );
  }
  if (kind === "coffee") {
    return (
      <svg width="84" height="84" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M6 2h12v2H6V2Zm1 4h10l-1 14H8L7 6Zm3 3v8h2V9h-2Zm4 0v8h2V9h-2Z"
        />
      </svg>
    );
  }
  // kettle
  return (
    <svg width="84" height="84" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3h6v2h-1v2.1a6.5 6.5 0 0 1 4 5.9v2a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6v-2a6.5 6.5 0 0 1 4-5.9V5H9V3Zm3 6a5 5 0 0 0-5 5v2a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4v-2a5 5 0 0 0-5-5Zm7-1h2v3h-2V8Z"
      />
    </svg>
  );
}

export default function BrewClient({ type, slug }: { type: string; slug: string }) {
  const title = useMemo(() => {
    const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
    return type === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
  }, [type, slug]);

  /* ---------- PREP SLIDES (inspiration fra reference) ---------- */
  const slides: Slide[] = useMemo(
    () => [
      {
        id: "tools",
        title: "Det skal du bruge",
        body: "Kværnet kaffe · varmt vand · filter · V60/dripper · kop/server · vægt · kedel.\nTip: kog lidt ekstra vand så koppen holder varmen.",
        icon: "tools",
      },
      {
        id: "dripper",
        title: "Dripper + filter",
        body: "Sæt dripperen på. Skyl filteret og hæld skyllevandet ud.\nNu er du klar til brew.",
        icon: "dripper",
      },
      {
        id: "coffee",
        title: "Kaffe i filteret",
        body: "Hæld kaffen i filteret. Ryst/tap let så bed’en bliver plan. Lav evt. en lille fordybning i midten.",
        icon: "coffee",
      },
      {
        id: "kettle",
        title: "Klar med vand",
        body: "Hav vandet klar (fx 92–96°C). Placér kop/server på vægten.\nNår du trykker Start Brew får du timer + step-guidance.",
        icon: "kettle",
      },
    ],
    []
  );

  /* ---------- STEPS (v2 hardcoded) ---------- */
  const steps: Step[] = useMemo(
    () => [
      {
        id: "prep",
        label: "Prep",
        instruction: "Skyl filter og varm kop/server. Nulstil vægten.",
        seconds: 20,
      },
      {
        id: "bloom",
        label: "Bloom",
        instruction: "Hæld jævnt til alle grunde er mættede.",
        targetG: 50,
        seconds: 35,
      },
      {
        id: "pour1",
        label: "Pour 1",
        instruction: "Hæld stabilt i cirkler. Roligt flow.",
        targetG: 150,
        seconds: 40,
      },
      {
        id: "pour2",
        label: "Pour 2",
        instruction: "Top op til slutvægt. Stop og lad dræne.",
        targetG: 300,
        seconds: 55,
      },
      {
        id: "finish",
        label: "Finish",
        instruction: "Swirl let. Smag og log resultat.",
        seconds: 25,
      },
    ],
    []
  );

  const totalSeconds = useMemo(
    () => steps.reduce((acc, s) => acc + (s.seconds || 0), 0),
    [steps]
  );

  /* ---------- STATE ---------- */
  const [stage, setStage] = useState<"prep" | "brew">("prep");
  const [slideIdx, setSlideIdx] = useState(0);

  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);

  const current = steps[idx];

  /* ---------- TIMER ---------- */
  useEffect(() => {
    if (!running) return;

    const t = window.setInterval(() => {
      setElapsed((p) => p + 1);
      setStepElapsed((p) => p + 1);
    }, 1000);

    return () => window.clearInterval(t);
  }, [running]);

  /* ---------- AUTO ADVANCE + REVIEW ---------- */
  useEffect(() => {
    const limit = current.seconds || 0;
    if (!running || !limit) return;
    if (stepElapsed < limit) return;

    try {
      navigator.vibrate?.([40, 40, 40]);
    } catch {}

    // sidste step => review
    if (idx >= steps.length - 1) {
      setRunning(false);

      const qs = new URLSearchParams({
        type,
        slug,
        seconds: String(elapsed),
        method: "Pour-over",
      });

      window.location.href = `/brew/review?${qs.toString()}`;
      return;
    }

    // ellers næste step (stopper auto så brugeren selv starter næste – “calm” UX)
    setRunning(false);
    setIdx((p) => p + 1);
    setStepElapsed(0);
  }, [stepElapsed, running, current.seconds, idx, steps.length, elapsed, slug, type]);

  useEffect(() => {
    setStepElapsed(0);
  }, [idx]);

  /* ---------- NAV ---------- */
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

  const primaryValue = current.targetG ? `${current.targetG}g` : idx === steps.length - 1 ? "Done" : "—";

  const actionLine = useMemo(() => {
    if (current.id === "prep") return "Prep – gør klar og nulstil vægten.";
    if (current.id === "finish") return "Finish – swirl og smag.";
    if (current.targetG) return `Pour til ${current.targetG}g.`;
    return current.instruction;
  }, [current]);

  /* ---------- START BREW ---------- */
  const startBrewFromPrep = () => {
    setStage("brew");
    setSlideIdx(0);

    // reset brew state (så det føles “fresh”)
    setIdx(0);
    setRunning(false);
    setElapsed(0);
    setStepElapsed(0);
    setSheetOpen(false);

    // vigtigt: undgå scroll-position carry-over
    try {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
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

      {/* ---------- STAGE 1: PREP SLIDES (over fold, no scroll) ---------- */}
    {stage === "prep" && (
  <section className={styles.prepStage} aria-label="Prep guide">
    <div className={styles.prepCard}>
      <div className={styles.prepIcon}>
        <SlideIcon kind={slides[slideIdx].icon} />
      </div>

      <h2 className={styles.prepTitle}>{slides[slideIdx].title}</h2>

      <p className={styles.prepText}>
        {slides[slideIdx].body.split("\n").map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>

      <div className={styles.dots} aria-label="Guide progress">
        {slides.map((s, i) => (
          <span
            key={s.id}
            className={`${styles.dot} ${i === slideIdx ? styles.dotActive : ""}`}
          />
        ))}
      </div>
    </div>

    <div className={styles.prepFooter}>
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => setSlideIdx((p) => Math.max(0, p - 1))}
        disabled={slideIdx === 0}
        aria-label="Forrige"
      >
        ‹
      </button>

      <button
        type="button"
        className={styles.primaryCta}
        onClick={() => {
          if (slideIdx < slides.length - 1) setSlideIdx((p) => p + 1);
          else startBrewFromPrep();
        }}
      >
        {slideIdx < slides.length - 1 ? "Næste" : "Start Brew"}
      </button>

      <button
        type="button"
        className={styles.navBtn}
        onClick={() => setSlideIdx((p) => Math.min(slides.length - 1, p + 1))}
        disabled={slideIdx === slides.length - 1}
        aria-label="Næste"
      >
        ›
      </button>
    </div>

    <button type="button" className={styles.skipBtn} onClick={startBrewFromPrep}>
      Skip
    </button>
  </section>
)}


      {/* ---------- STAGE 2: BREW COCKPIT ---------- */}
      {stage === "brew" && (
        <>
          <section className={styles.cockpit}>
            <div className={styles.timerRow}>
              <div className={styles.timer}>{formatMMSS(elapsed)}</div>

              <button className={styles.stepPill} onClick={() => setSheetOpen((v) => !v)}>
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

              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => {
                  // sidste step: knappen bliver “Review”
                  if (idx >= steps.length - 1) {
                    const qs = new URLSearchParams({
                      type,
                      slug,
                      seconds: String(elapsed),
                      method: "Pour-over",
                    });
                    window.location.href = `/brew/review?${qs.toString()}`;
                    return;
                  }
                  setRunning((v) => !v);
                }}
              >
                {idx >= steps.length - 1 ? "Review" : running ? "Pause" : "Start"}
              </button>

              <button className={styles.btn} onClick={goNext} disabled={idx === steps.length - 1}>
                →
              </button>
            </div>

            <div className={styles.microRow}>
              <span>
                Step tilbage:{" "}
                <strong>
                  {stepSeconds ? formatMMSS(Math.max(0, stepSeconds - stepElapsed)) : "—"}
                </strong>
              </span>
              <span>
                Total: <strong>{formatMMSS(totalSeconds)}</strong>
              </span>
            </div>
          </section>

          {/* Bottom sheet (kan beholdes / kan fjernes når UI er helt “one-screen”) */}
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
        </>
      )}
    </main>
  );
}
