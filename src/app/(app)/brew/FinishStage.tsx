"use client";

import { useMemo, useState } from "react";
import styles from "./FinishStage.module.css";

type Domain = "coffee" | "tea";

type Props = {
  title?: string;
  subtitle?: string;

  onSave?: () => void;
  onDone?: () => void;
  onBrewAgain?: () => void;

  variantId?: string; // uuid
  domain?: Domain;

  // metadata til variant_taste_vectors
  productSlug?: string;
  label?: string;
};

const MIN_CONF_FOR_TASTE_MSG = 3;

function tasteMessage(yHat: number) {
  if (yHat >= 0.7) return "Meget tæt på din smag.";
  if (yHat >= 0.5) return "Indenfor din smags-range.";
  return "Udenfor din typiske smag (stadig værdifuldt datapunkt).";
}

function StarRow({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          aria-label={`${s} stars`}
          style={{
            fontSize: 30,
            lineHeight: 1,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {s <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

async function fetchConfidence(domain: Domain): Promise<number | null> {
  try {
    const res = await fetch(`/api/profile/domain?domain=${domain}`, { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) return null;
    const n = Number(json?.confidence_count);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function FinishStage({
  title = "Brew complete",
  subtitle = "Done. Smag først. Justér bagefter.",
  onSave,
  onDone,
  onBrewAgain,
  variantId,
  domain,
  productSlug,
  label,
}: Props) {
  const [stars, setStars] = useState(0);
  const [isSavingRating, setIsSavingRating] = useState(false);
  const [ratingSaved, setRatingSaved] = useState(false);
  const [ratingMsg, setRatingMsg] = useState<string | null>(null);

  const canRate = useMemo(() => {
    return !!variantId && (domain === "coffee" || domain === "tea");
  }, [variantId, domain]);

  const canSubmitRating = canRate && stars >= 1 && !isSavingRating && !ratingSaved;

  async function saveRating() {
    if (!canSubmitRating || !variantId || !domain) return;

    setIsSavingRating(true);
    setRatingMsg(null);

    try {
      const res = await fetch("/api/taste/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: variantId,
          domain,
          stars,
          product_slug: productSlug,
          label,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Kunne ikke gemme rating");

      setRatingSaved(true);

      // ✅ Gate smagsbeskeder indtil vi har nok datapunkter
      const conf = await fetchConfidence(domain);
      if (conf !== null && conf < MIN_CONF_FOR_TASTE_MSG) {
        const left = Math.max(0, MIN_CONF_FOR_TASTE_MSG - conf);
        setRatingMsg(
          left > 0
            ? `Tak! Giv ${left} rating${left === 1 ? "" : "s"} mere, så kan vi lære din smag.`
            : "Tak! Vi lærer din smag…"
        );
      } else {
        const yHat = Number(json?.debug?.yHat);
        setRatingMsg(Number.isFinite(yHat) ? tasteMessage(yHat) : "Tak! Rating gemt.");
      }

      // ✅ Events: bruges til at refetch på Taste/Profile/Bar
      try {
        window.dispatchEvent(new Event("brewnote_rating_logged"));
        window.dispatchEvent(new Event("brewnote_profile_changed"));
        window.dispatchEvent(new Event("brewnote_bar_changed"));
      } catch {}
    } catch (e: any) {
      setRatingMsg(e?.message || "Noget gik galt");
      setRatingSaved(false);
    } finally {
      setIsSavingRating(false);
    }
  }

  function primaryAction() {
    if (onSave) return onSave();
    if (onDone) return onDone();
  }

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <div className={styles.badge}>FINISH</div>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.sub}>{subtitle}</p>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, opacity: 0.95 }}>Hvordan smagte det?</div>

          <StarRow value={stars} onChange={setStars} disabled={isSavingRating || ratingSaved} />

          {!canRate ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Rating er klar, men mangler <code>variantId</code> + <code>domain</code>.
            </div>
          ) : (
            <button
              type="button"
              onClick={saveRating}
              disabled={!canSubmitRating}
              className={styles.secondary}
              style={{ justifySelf: "start" }}
            >
              {ratingSaved ? "Gemt ✅" : isSavingRating ? "Gemmer..." : "Gem rating"}
            </button>
          )}

          {ratingMsg ? <div style={{ fontSize: 12, opacity: 0.85 }}>{ratingMsg}</div> : null}
        </div>
      </main>

      <footer className={styles.footer}>
        {onBrewAgain ? (
          <button className={styles.secondary} onClick={onBrewAgain}>
            Bryg igen
          </button>
        ) : null}

        {onSave ? (
          <button className={styles.primary} onClick={primaryAction}>
            Gem bryg
          </button>
        ) : onDone ? (
          <button className={styles.primary} onClick={primaryAction}>
            Done
          </button>
        ) : (
          <button className={styles.primary} onClick={() => {}}>
            Done
          </button>
        )}
      </footer>
    </div>
  );
}