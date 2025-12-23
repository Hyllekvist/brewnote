"use client"; 

import { useCallback, useMemo, useState } from "react";

import { PrepStage } from "./PrepStage";
import { BrewStage, type BrewStep, type BrewPhase } from "./BrewStage";
import { FinishStage } from "./FinishStage";

type Domain = "coffee" | "tea";

/* ---------- helpers ---------- */

function toTitle(type: string, slug: string) {
  const name = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "Brew Mode";
  return type === "tea" ? `Tea Brew — ${name}` : `Coffee Brew — ${name}`;
}

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

// Deterministisk UUID fra string (pseudo-variant-id pr slug+type)
// (Ikke kryptografisk, men stabil og RFC4122-ish)
function fnv1a32(str: string, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function stableUuidFromString(input: string) {
  const h1 = fnv1a32(input, 0x811c9dc5);
  const h2 = fnv1a32(input, 0x811c9dc5 ^ 0x9e3779b9);
  const h3 = fnv1a32(input, 0x811c9dc5 ^ 0x7f4a7c15);
  const h4 = fnv1a32(input, 0x811c9dc5 ^ 0x94d049bb);

  // 16 bytes
  const b = new Uint8Array(16);
  const parts = [h1, h2, h3, h4];
  for (let p = 0; p < 4; p++) {
    const x = parts[p];
    b[p * 4 + 0] = (x >>> 24) & 0xff;
    b[p * 4 + 1] = (x >>> 16) & 0xff;
    b[p * 4 + 2] = (x >>> 8) & 0xff;
    b[p * 4 + 3] = x & 0xff;
  }

  // set version = 4 (0100)
  b[6] = (b[6] & 0x0f) | 0x40;
  // set variant = RFC4122 (10xx)
  b[8] = (b[8] & 0x3f) | 0x80;

  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/* ---------- component ---------- */

export default function BrewClient({ type, slug }: { type: string; slug: string }) {
  const domain: Domain = type === "tea" ? "tea" : "coffee";
  const title = useMemo(() => toTitle(type, slug), [type, slug]);

  // pseudo-variant-id pr produkt (indtil I har rigtige variant_id’er)
  const variantId = useMemo(() => stableUuidFromString(`${domain}:${slug}`), [domain, slug]);

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

  const [stage, setStage] = useState<"prep" | "brew" | "finish">("prep");
  const [activeIndex, setActiveIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const onTick = useCallback(() => {
    setElapsedSeconds((p) => p + 1);
  }, []);

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

  const onFinish = useCallback(() => {
    setIsRunning(false);
    setStage("finish");
  }, []);

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

  // v1 hardcoded (gør dynamisk senere)
  const doseG = 18;
  const waterG = 300;
  const ratioLabel = "1:16.7";
  const methodName = "Pour-over";

  const saveBrew = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const user_key = getUserKey();

      const payload = {
        user_key,
        product_slug: slug,
        product_type: domain, // ✅ FIX: din save-route kræver den
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

      // ✅ events (til BarClient + badges osv.)
      window.dispatchEvent(new Event("brewnote_brew_logged"));
      window.dispatchEvent(new Event("brewnote_bar_changed"));

      // ✅ build qs før redirect
      const qs = new URLSearchParams({
        type,
        slug,
        seconds: String(elapsedSeconds),
        method: methodName,
        planned: String(totalPlannedSeconds),
      });

      window.location.href = `/brew/review?${qs.toString()}`;
    } catch (e: any) {
      alert(e?.message || "Kunne ikke gemme bryg");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, slug, domain, elapsedSeconds, totalPlannedSeconds]);

  const prepSummary = useMemo(() => {
    return {
      title,
      doseG,
      waterG,
      ratioLabel,
      estTotalSeconds: totalPlannedSeconds,
    };
  }, [title, totalPlannedSeconds]);

  if (stage === "prep") {
    return <PrepStage summary={prepSummary} onStart={startBrew} />;
  }

  if (stage === "finish") {
    return (
<FinishStage
  title="Brew complete"
  onSave={saveBrew}
  domain={domain}
  variantId={variantId}
  productSlug={slug}
  label={decodeURIComponent(slug).replace(/-/g, " ")}
/>
    );
  }

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