"use client";

import { useCallback, useMemo, useState } from "react";

// ✅ stages (tilpas path hvis nødvendigt)
import { PrepStage } from "./PrepStage";
import { BrewStage, type BrewStep, type BrewPhase } from "./BrewStage";
import { FinishStage } from "./FinishStage";

function toTitle(type: string, slug: string) {
  const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
  return type === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
}

// 🔒 v1: map label/id -> phase (ring semantik)
function phaseForStep(id: string, label: string): BrewPhase {
  const l = (label || "").toLowerCase();
  if (id === "bloom" || l.includes("bloom")) return "bloom";
  if (id === "finish" || l.includes("finish")) return "finish";
  return "pour";
}

function getUserKey() {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem("brewnote_user_key");
  if (existing) return existing;

  const newKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `u_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  window.localStorage.setItem("brewnote_user_key", newKey);
  return newKey;
}

export default function BrewClient({ type, slug }: { type: string; slug: string }) {
  const title = useMemo(() => toTitle(type, slug), [type, slug]);

  // ✅ steps — nu med phase
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

  // save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // tick
  const onTick = useCallback(() => {
    setElapsedSeconds((p) => p + 1);
  }, []);

  // auto-advance når step-tid er gået
  const onAutoAdvanceIfNeeded = useCallback(() => {
    const step = steps[activeIndex];
    const stepSeconds = step?.seconds ?? 0;
    if (!stepSeconds) return;

    const stepStart = steps
      .slice(0, activeIndex)
      .reduce((acc, s) => acc + (s.seconds ?? 0), 0);

    const inStep = elapsedSeconds - stepStart;
    if (inStep < stepSeconds) return;

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

  // tap-to-skip (gesture)
  const onTap = useCallback(() => {
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

  // start brew
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

  // --- brew params (v1 hardcoded; næste step er at gøre dem dynamiske) ---
  const doseG = 18;
  const waterG = 300;
  const ratioLabel = "1:16.7";
  const methodName = "Pour-over";

  // save brew -> logger brew_sessions -> redirect review
  const saveBrew = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const user_key = getUserKey();

      const payload = {
        user_key,
        product_slug: slug,
        method: methodName,
        ratio_label: ratioLabel,
        dose_g: doseG,
        water_g: waterG,
        total_seconds: elapsedSeconds,
      };

      const res = await fetch("/api/brew/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.body || `HTTP ${res.status}`);
      }

      const qs = new URLSearchParams({
        type,
        slug,
        seconds: String(elapsedSeconds),
        method: methodName,
        planned: String(totalPlannedSeconds),
      });

      window.location.href = `/brew/review?${qs.toString()}`;
    } catch (e: any) {
      const msg = e?.message || "Kunne ikke gemme bryg";
      setSaveError(msg);
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    slug,
    type,
    elapsedSeconds,
    totalPlannedSeconds,
    doseG,
    waterG,
    ratioLabel,
    methodName,
  ]);

  // summary til prep
  const prepSummary = useMemo(() => {
    return {
      title,
      doseG,
      waterG,
      ratioLabel,
      estTotalSeconds: totalPlannedSeconds,
    };
  }, [title, totalPlannedSeconds, doseG, waterG, ratioLabel]);

  // render stage
  if (stage === "prep") {
    return <PrepStage summary={prepSummary} onStart={startBrew} />;
  }

  if (stage === "finish") {
    return (
      <FinishStage
        title="Brew complete"
        onSave={saveBrew}
        // hvis din FinishStage ikke understøtter props her, så ignorer dem
        // (jeg kan opdatere FinishStage bagefter)
        isSaving={isSaving as any}
        error={saveError as any}
      />
    );
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
