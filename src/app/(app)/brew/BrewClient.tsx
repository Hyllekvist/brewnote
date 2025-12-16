"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import styles from "./BrewClient.module.css";

type Step = {
  id: string;
  label: string;
  instruction: string;
  targetG?: number;
  seconds?: number;
};

type SetupCard = {
  id: string;
  title: string;
  body: string;
  meta?: string;
  icon: "gear" | "kettle" | "scale" | "dripper" | "coffee";
};

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Icon({ name }: { name: SetupCard["icon"] }) {
  // simple inline SVGs (no assets)
  if (name === "kettle")
    return (
      <svg viewBox="0 0 64 64" className={styles.bigIcon} aria-hidden="true">
        <path
          d="M14 44c0 8 6 14 14 14h10c8 0 14-6 14-14V30c0-6-4-10-10-10H30c-6 0-10 4-10 10v14Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M44 22c4 0 8 3 8 7v6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M22 18c2-4 6-8 12-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );

  if (name === "scale")
    return (
      <svg viewBox="0 0 64 64" className={styles.bigIcon} aria-hidden="true">
        <rect x="12" y="20" width="40" height="32" rx="10" fill="none" stroke="currentColor" strokeWidth="3" />
        <rect x="22" y="28" width="20" height="10" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="20" cy="46" r="2" fill="currentColor" />
        <circle cx="26" cy="46" r="2" fill="currentColor" />
      </svg>
    );

  if (name === "dripper")
    return (
      <svg viewBox="0 0 64 64" className={styles.bigIcon} aria-hidden="true">
        <path
          d="M18 18h28l-6 16c-2 6-6 10-8 10s-6-4-8-10l-6-16Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M22 46h20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 46v10h8V46" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    );

  if (name === "coffee")
    return (
      <svg viewBox="0 0 64 64" className={styles.bigIcon} aria-hidden="true">
        <path d="M18 26h28v12c0 8-6 14-14 14s-14-6-14-14V26Z" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M46 28h3c5 0 9 4 9 9s-4 9-9 9h-3" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M20 56h24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );

  // gear
  return (
    <svg viewBox="0 0 64 64" className={styles.bigIcon} aria-hidden="true">
      <path
        d="M28 8h8l2 6 6 2 6-2 4 8-5 4v8l5 4-4 8-6-2-6 2-2 6h-8l-2-6-6-2-6 2-4-8 5-4v-8l-5-4 4-8 6 2 6-2 2-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="7" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export default function BrewClient({ type, slug }: { type: string; slug: string }) {
  /* ---------- TITLE ---------- */
  const title = useMemo(() => {
    const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
    return type === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
  }, [type, slug]);

  /* ---------- SETUP (over-fold wizard) ---------- */
  const setupCards: SetupCard[] = useMemo(
    () => [
      {
        id: "need",
        icon: "gear",
        title: "Det skal du bruge",
        body: "Kværnet kaffe · varmt vand · filter · V60/dripper · kop/server · vægt · kedel",
        meta: "Tip: kog lidt ekstra vand så koppen holder varmen.",
      },
      { id: "kettle", icon: "kettle", title: "Kog vandet", body: "Sigt efter ca. 92–96°C (eller det du foretrækker).", meta: "Start når du er klar." },
      { id: "scale", icon: "scale", title: "Kop på vægten", body: "Sæt kop/server på vægten. Tænd vægten (tare senere).", meta: "Hold opsætningen stabil." },
      { id: "dripper", icon: "dripper", title: "Dripper + filter", body: "Sæt dripperen på. Skyl filteret og hæld skyllevandet ud.", meta: "Nu er du klar til brew." },
    ],
    []
  );

  const [mode, setMode] = useState<"setup" | "brew">("setup");
  const [setupIdx, setSetupIdx] = useState(0);

  const setupNext = () => setSetupIdx((p) => Math.min(setupCards.length - 1, p + 1));
  const setupPrev = () => setSetupIdx((p) => Math.max(0, p - 1));
  const setupDone = () => setMode("brew");

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

  const totalSeconds = useMemo(() => steps.reduce((acc, s) => acc + (s.seconds || 0), 0), [steps]);

  /* ---------- BREW STATE ---------- */
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);

  const current = steps[idx];
  const isLast = idx === steps.length - 1;

  const goToReview = useCallback(() => {
    const qs = new URLSearchParams({
      type,
      slug,
      seconds: String(elapsed),
      method: "Pour-over",
    });
    window.location.href = `/brew/review?${qs.toString()}`;
  }, [elapsed, slug, type]);

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
    if (!running) return;

    const limit = current.seconds || 0;
    if (!limit) return;
    if (stepElapsed < limit) return;

    try {
      navigator.vibrate?.([40, 40, 40]);
    } catch {}

    if (isLast) {
      setRunning(false);
      goToReview();
      return;
    }

    setIdx((p) => Math.min(steps.length - 1, p + 1));
    setStepElapsed(0);
  }, [running, stepElapsed, current.seconds, isLast, steps.length, goToReview]);

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

  const primaryValue = current.targetG ? `${current.targetG}g` : "—";

  const actionLine = useMemo(() => {
    if (current.id === "prep") return "Prep – gør klar og nulstil vægten.";
    if (current.id === "finish") return "Finish – swirl og smag.";
    if (current.targetG) return `Pour til ${current.targetG}g.`;
    return current.instruction;
  }, [current]);

  const onPrimary = () => {
    if (isLast && !running) {
      goToReview();
      return;
    }
    setRunning((v) => !v);
  };

  const primaryText = isLast ? (running ? "Pause" : "Review") : running ? "Pause" : "Start";

  /* ---------- RENDER: SETUP ---------- */
  if (mode === "setup") {
    const c = setupCards[setupIdx];
    const isFirst = setupIdx === 0;
    const isLastSetup = setupIdx === setupCards.length - 1;

    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <a className={styles.iconBtn} href="/" aria-label="Tilbage">
            ←
          </a>

          <div className={styles.topTitle}>
            <div className={styles.kicker}>PREP</div>
            <div className={styles.h1} title={title}>
              {title}
            </div>
          </div>

          <button className={styles.iconBtn} onClick={() => setMode("brew")} aria-label="Skip">
            Skip
          </button>
        </header>

        <section className={styles.setupWrap}>
          <div className={styles.setupCard}>
            <div className={styles.setupIcon}>
              <Icon name={c.icon} />
            </div>

            <div className={styles.setupTitle}>{c.title}</div>
            <div className={styles.setupBody}>{c.body}</div>
            {c.meta ? <div className={styles.setupMeta}>{c.meta}</div> : null}

            <div className={styles.dots} aria-label="Setup progress">
              {setupCards.map((_, i) => (
                <span key={i} className={`${styles.dot} ${i === setupIdx ? styles.dotOn : ""}`} />
              ))}
            </div>
          </div>

          <div className={styles.setupActions}>
            <button className={styles.pillBtn} onClick={setupPrev} disabled={isFirst} aria-label="Forrige">
              ‹
            </button>

            <button
              className={`${styles.ctaBtn} ${styles.ctaBtnPrimary}`}
              onClick={isLastSetup ? setupDone : setupNext}
            >
              {isLastSetup ? "Start Brew" : "Næste"}
            </button>

            <button className={styles.pillBtn} onClick={setupNext} disabled={isLastSetup} aria-label="Næste">
              ›
            </button>
          </div>

          <div className={styles.setupFooterHint}>
            Når du trykker <strong>Start Brew</strong> får du timer + step-guidance uden scroll.
          </div>
        </section>
      </main>
    );
  }

  /* ---------- RENDER: BREW ---------- */
  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <a className={styles.iconBtn} href={slug ? `/coffees/${encodeURIComponent(slug)}` : "/"} aria-label="Tilbage">
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
            aria-label="Step progress"
          >
            <div className={styles.ringInner}>
              <div className={styles.bigNumber}>{isLast ? "Done" : primaryValue}</div>
            </div>
          </div>
        </div>

        <p className={styles.instruction}>
          <strong>{actionLine}</strong>
          <br />
          <span className={styles.subInstruction}>{current.instruction}</span>
        </p>

        <div className={styles.controls}>
          <button className={styles.btn} onClick={goPrev} disabled={idx === 0} aria-label="Forrige step">
            ←
          </button>

          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onPrimary}>
            {primaryText}
          </button>

          <button className={styles.btn} onClick={goNext} disabled={idx === steps.length - 1} aria-label="Næste step">
            →
          </button>
        </div>

        <div className={styles.microRow}>
          <span>
            Step tilbage: <strong>{stepSeconds ? formatMMSS(Math.max(0, stepSeconds - stepElapsed)) : "—"}</strong>
          </span>
          <span>
            Total: <strong>{formatMMSS(totalSeconds)}</strong>
          </span>
        </div>
      </section>

      <section className={`${styles.sheet} ${sheetOpen ? styles.sheetOpen : ""}`}>
        <div className={styles.sheetHandle} onClick={() => setSheetOpen((v) => !v)} role="button" tabIndex={0} />

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