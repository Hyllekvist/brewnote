"use client";

import { useCallback, useMemo, useState } from "react";

// ✅ nye stages (tilpas path hvis nødvendigt)
import { PrepStage } from "./PrepStage";
import { BrewStage, type BrewStep, type BrewPhase } from "./BrewStage";
import { FinishStage } from "./FinishStage";

// (valgfrit) behold din eksisterende BrewClient.module.css hvis du vil,
// men BrewClient skal reelt ikke style noget længere.
// import styles from "./BrewClient.module.css";

function toTitle(type: string, slug: string) {
  const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
  return type === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
}

// 🔒 v1: map label/id -> phase (ring semantik)
function phaseForStep(id: string, label: string): BrewPhase {
  const l = (label || "").toLowerCase();
  if (id === "bloom" || l.includes("bloom")) return "bloom";
  if (id === "finish" || l.includes("finish")) return "finish";
  // alt pour / mellemsteps
  return "pour";
}

export default function BrewClient({ type, slug }: { type: string; slug: string }) {
  const title = useMemo(() => toTitle(type, slug), [type, slug]);

  // ✅ dine eksisterende steps — nu med phase
  const steps: BrewStep[] = useMemo(
    () => [
      {
        id: "bloom",
        label: "Bloom",
        instruction: "Hæld jævnt til alle grunde er mættede.",
        targetG: 50,
        seconds: 35,
        phase: phaseForStep("bloom", "Bloom"),
      },
      {
        id: "pour1",
        label: "Pour 1",
        instruction: "Hæld stabilt i cirkler. Roligt flow.",
        targetG: 150,
        seconds: 40,
        phase: phaseForStep("pour1", "Pour 1"),
      },
      {
        id: "pour2",
        label: "Pour 2",
        instruction: "Top op til slutvægt. Stop og lad dræne.",
        targetG: 300,
        seconds: 55,
        phase: phaseForStep("pour2", "Pour 2"),
      },
      {
        id: "finish",
        label: "Finish",
        instruction: "Swirl let. Smag og log resultat.",
        seconds: 25,
        phase: phaseForStep("finish", "Finish"),
      },
    ],
    []
  );

  const totalPlannedSeconds = useMemo(
    () => steps.reduce((acc, s) => acc + (s.seconds ?? 0), 0),
    [steps]
  );

  // 🔒 stages: prep -> brew -> finish
  const [stage, setStage] = useState<"prep" | "brew" | "finish">("prep");

  // brew state
  const [activeIndex, setActiveIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // tick
  const onTick = useCallback(() => {
    setElapsedSeconds((p) => p + 1);
  }, []);

  // auto-advance når step-tid er gået (kører mens running = true)
  const onAutoAdvanceIfNeeded = useCallback(() => {
    const step = steps[activeIndex];
    const stepSeconds = step?.seconds ?? 0;
    if (!stepSeconds) return;

    const stepStart = steps
      .slice(0, activeIndex)
      .reduce((acc, s) => acc + (s.seconds ?? 0), 0);

    const inStep = elapsedSeconds - stepStart;
    if (inStep < stepSeconds) return;

    // step færdig
    try {
      navigator.vibrate?.([30, 30, 30]);
    } catch {}

    const isLast = activeIndex >= steps.length - 1;
    if (isLast) {
      setIsRunning(false);
      setStage("finish");
      return;
    }

    setActiveIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [steps, activeIndex, elapsedSeconds]);

  // finish (hard stop)
  const onFinish = useCallback(() => {
    setIsRunning(false);
    setStage("finish");
  }, []);

  // tap-to-skip (gesture) — kun når vi er i brew
  const onTap = useCallback(() => {
    // skip til næste step (og fortsæt running)
    const isLast = activeIndex >= steps.length - 1;
    if (isLast) {
      onFinish();
      return;
    }
    try {
      navigator.vibrate?.([20]);
    } catch {}
    setActiveIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [activeIndex, steps.length, onFinish]);

  // start brew: reset + running on
  const startBrew = useCallback(() => {
    setStage("brew");
    setActiveIndex(0);
    setElapsedSeconds(0);
    setIsRunning(true);

    try {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
  }, []);

  // save brew -> review redirect (midlertidigt)
  const saveBrew = useCallback(() => {
    const qs = new URLSearchParams({
      type,
      slug,
      seconds: String(elapsedSeconds),
      method: "Pour-over",
      planned: String(totalPlannedSeconds),
    });
    window.location.href = `/brew/review?${qs.toString()}`;
  }, [type, slug, elapsedSeconds, totalPlannedSeconds]);

  // summary til prep
  const prepSummary = useMemo(() => {
    return {
      title,
      doseG: 18,
      waterG: 300,
      ratioLabel: "1:16.7",
      estTotalSeconds: totalPlannedSeconds,
    };
  }, [title, totalPlannedSeconds]);

  // render stage
  if (stage === "prep") {
    return <PrepStage summary={prepSummary} onStart={startBrew} />;
  }

  if (stage === "finish") {
    return <FinishStage title="Brew complete" onSave={saveBrew} />;
  }

  // stage === "brew"
  return (
    <BrewStage
      steps={steps}
      activeIndex={activeIndex}
      elapsedSeconds={elapsedSeconds}
      isRunning={isRunning}
      onTick={onTick}
      onAutoAdvanceIfNeeded={onAutoAdvanceIfNeeded}
      onFinish={onFinish}
      onTap={onTap}
    />
  );
}
