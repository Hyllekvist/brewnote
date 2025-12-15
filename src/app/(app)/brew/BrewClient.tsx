"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./BrewClient.module.css";
import { getRecipe } from "@/lib/brew/recipes";
import type { BrewType } from "@/lib/brew/types";

function formatMMSS(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function BrewClient({ type, slug }: { type: string; slug: string }) {
  const brewType: BrewType = type === "tea" ? "tea" : "coffee";
  const recipe = useMemo(() => getRecipe(brewType), [brewType]);

  const title = useMemo(() => {
    const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
    return brewType === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
  }, [brewType, slug]);

  const totalSeconds = recipe.totalSeconds;

  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);

  // “Vægt” v1 (manuel input indtil hardware)
  const [currentG, setCurrentG] = useState(0);

  // Total elapsed (sekunder)
  const [elapsed, setElapsed] = useState(0);

  // Quick adjust hint (sur/bitter)
  const [adjustHint, setAdjustHint] = useState<string | null>(null);

  // timer
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setElapsed((p) => clamp(p + 1, 0, totalSeconds));
    }, 1000);
    return () => clearInterval(t);
  }, [running, totalSeconds]);

  const steps = recipe.steps;
  const current = steps[idx];

  const stepStart = useMemo(() => {
    let s = 0;
    for (let i = 0; i < idx; i++) s += steps[i].seconds || 0;
    return s;
  }, [idx, steps]);

  const stepSeconds = current.seconds || 0;
  const stepElapsed = clamp(elapsed - stepStart, 0, stepSeconds || 0);
  const stepRemaining = Math.max(0, stepSeconds - stepElapsed);

  // Hybrid progress:
  // - pour steps: grams progress (currentG/targetG) if target exists
  // - else: time progress (stepElapsed/stepSeconds)
  const progress01 = useMemo(() => {
    if (current.targetG && current.kind === "pour") {
      return clamp(currentG / current.targetG, 0, 1);
    }
    if (stepSeconds > 0) return clamp(stepElapsed / stepSeconds, 0, 1);
    return 0;
  }, [current.kind, current.targetG, currentG, stepElapsed, stepSeconds]);

  const progressDeg = Math.round(progress01 * 360);

  // “Hvad gør jeg nu?” + “Hvornår færdig?”
  const nowLine = useMemo(() => {
    if (current.targetG && current.kind === "pour") {
      const left = Math.max(0, current.targetG - currentG);
      return left <= 0 ? `Mål nået (${current.targetG}g)` : `Manglende: ${left}g`;
    }
    return stepSeconds ? `Tilbage: ${formatMMSS(stepRemaining)}` : "—";
  }, [current, currentG, stepRemaining, stepSeconds]);

  const canPrev = idx > 0;
  const canNext = idx < steps.length - 1;

  function goPrev() {
    setIdx((p) => Math.max(0, p - 1));
    setRunning(false);
  }

  function goNext() {
    setIdx((p) => Math.min(steps.length - 1, p + 1));
    setRunning(false);
  }

  function jumpTo(i: number) {
    setIdx(clamp(i, 0, steps.length - 1));
    setRunning(false);
  }

  function resetForThisStep() {
    // small quality-of-life: reset grams for steps that have a target
    if (current.targetG && current.kind === "pour") setCurrentG(0);
  }

  const maxSlider = recipe.waterG || 400;

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <a
          className={styles.back}
          href={slug ? `/coffees/${encodeURIComponent(slug)}` : "/"}
          aria-label="Tilbage"
        >
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

      <section className={styles.deviceCard}>
        {/* Brew Card (metoden + hvorfor) */}
        <div className={styles.brewCard}>
          <div className={styles.brewCardTop}>
            <div>
              <div className={styles.brewMethod}>{recipe.method}</div>
              <div className={styles.brewWhy}>{recipe.why}</div>
            </div>

            <div className={styles.brewFacts}>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Ratio</span>
                <span className={styles.factVal}>{recipe.ratioText}</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Grind</span>
                <span className={styles.factVal}>{recipe.grindText}</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Temp</span>
                <span className={styles.factVal}>{recipe.tempText}</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Total</span>
                <span className={styles.factVal}>{formatMMSS(totalSeconds)}</span>
              </div>
            </div>
          </div>

          {/* Quick adjust */}
          <div className={styles.adjustRow}>
            <button
              className={styles.adjustBtn}
              onClick={() =>
                setAdjustHint("For sur → finere grind, +1–2°C, længere bloom (10–15s).")
              }
              type="button"
            >
              For sur?
            </button>
            <button
              className={styles.adjustBtn}
              onClick={() =>
                setAdjustHint("For bitter → grovere grind, -1–2°C, kortere total (10–20s).")
              }
              type="button"
            >
              For bitter?
            </button>
            <button className={styles.adjustBtnGhost} onClick={() => setAdjustHint(null)} type="button">
              Nulstil
            </button>
          </div>

          {adjustHint ? <div className={styles.adjustHint}>{adjustHint}</div> : null}
        </div>

        {/* Main hero ring */}
        <div className={styles.ringWrap}>
          <div className={styles.ringArea}>
            <div className={styles.sideStat}>
              <div>
                <div className={styles.sideLabel}>NU</div>
                <div className={styles.sideValue}>{nowLine}</div>
              </div>
            </div>

            <div className={styles.ring}>
              <div
                className={styles.pie}
                style={{
                  background: `conic-gradient(var(--ok) 0deg ${progressDeg}deg, rgba(255,255,255,.10) ${progressDeg}deg 360deg)`,
                }}
              />
              <div className={styles.readout}>
                <div className={styles.big}>
                  {current.targetG && current.kind === "pour" ? `${current.targetG}g` : formatMMSS(stepRemaining)}
                </div>
                <div className={styles.subRow}>
                  <div>
                    <span className={styles.subK}>WEIGHT</span>{" "}
                    <strong>{currentG}g</strong>
                  </div>
                  <div>
                    <span className={styles.subK}>FLOW</span>{" "}
                    <strong>3.5g/s</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${styles.sideStat} ${styles.sideStatRight}`}>
              <div>
                <div className={styles.sideLabel}>STEP</div>
                <div className={styles.sideValue}>
                  {idx + 1}/{steps.length} · {current.label}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.stepMeta}>
            <div className={styles.stepIndex}>
              {idx + 1}/{steps.length}
            </div>
            <button className={styles.smallLink} onClick={resetForThisStep} type="button">
              Nulstil step
            </button>
          </div>

          <p className={styles.stepText}>{current.instruction}</p>

          {/* Manual grams controls (only show when it matters) */}
          {current.targetG && current.kind === "pour" ? (
            <div className={styles.gramsCard}>
              <div className={styles.gramsTop}>
                <div className={styles.gramsTitle}>Jeg er på</div>
                <div className={styles.gramsValue}>{currentG}g</div>
              </div>

              <input
                className={styles.slider}
                type="range"
                min={0}
                max={maxSlider}
                value={currentG}
                onChange={(e) => setCurrentG(Number(e.target.value))}
              />

              <div className={styles.gramsBtns}>
                <button className={styles.btn} onClick={() => setCurrentG((g) => clamp(g - 5, 0, maxSlider))} type="button">
                  − 5g
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setCurrentG((g) => clamp(g + 5, 0, maxSlider))} type="button">
                  + 5g
                </button>
                <button className={styles.btn} onClick={() => setCurrentG(0)} type="button">
                  0
                </button>
              </div>
            </div>
          ) : null}

          {/* Controls */}
          <div className={styles.controls}>
            <button className={styles.btn} onClick={goPrev} disabled={!canPrev} type="button">
              ← Forrige
            </button>

            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setRunning((v) => !v)}
              type="button"
            >
              {running ? "Pause" : "Start"}
            </button>

            <button className={styles.btn} onClick={goNext} disabled={!canNext} type="button">
              Næste →
            </button>
          </div>

          {/* Rail */}
          <div className={styles.railWrap}>
            <div className={styles.railMeta}>
              <strong>Steps</strong>
              <span>Total {formatMMSS(totalSeconds)}</span>
            </div>

            <div className={styles.rail} aria-label="Steps">
              {steps.map((s, i) => {
                const active = i === idx;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={active ? `${styles.stepChip} ${styles.stepChipActive}` : styles.stepChip}
                    onClick={() => jumpTo(i)}
                  >
                    <div className={styles.stepChipTop}>
                      <span>{i + 1}</span>
                      <span>{s.seconds ? `${s.seconds}s` : "—"}</span>
                    </div>
                    <div className={styles.stepChipMid}>{s.label}</div>
                    <div className={styles.stepChipBottom}>
                      {s.targetG ? `${s.targetG}g` : "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.bottomActions}>
            <button className={styles.flatBtn} type="button">Log resultat</button>
            <button className={styles.flatBtn} type="button">Gem som preset</button>
          </div>
        </div>
      </section>
    </main>
  );
}
