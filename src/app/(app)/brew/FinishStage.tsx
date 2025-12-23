"use client";

import { useMemo, useState } from "react";
import styles from "./FinishStage.module.css";

type Domain = "coffee" | "tea";

type Props = {
  title?: string;
  subtitle?: string;

  // eksisterende callbacks
  onSave?: () => void;
  onDone?: () => void;
  onBrewAgain?: () => void;
productSlug?: string;
label?: string;
  // ✅ NYT: kræves for at lære noget meningsfuldt
  variantId?: string;      // uuid
  domain?: Domain;         // "coffee" | "tea"
};

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

export function FinishStage({
  title = "Brew complete",
  subtitle = "Done. Smag først. Justér bagefter.",
  onSave,
  onDone,
  onBrewAgain,

  variantId,
  domain,
}: Props) {
  const [stars, setStars] = useState(0);
  const [isSavingRating, setIsSavingRating] = useState(false);
  const [ratingMsg, setRatingMsg] = useState<string | null>(null);

  const canRate = useMemo(() => {
    return !!variantId && (domain === "coffee" || domain === "tea");
  }, [variantId, domain]);

  const canSubmitRating = canRate && stars >= 1 && !isSavingRating;

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

      const yHat = Number(json?.debug?.yHat);
      setRatingMsg(Number.isFinite(yHat) ? tasteMessage(yHat) : "Tak! Rating gemt.");

      // optional: hvis du vil trigge noget efter rating
      // onSave?.();
    } catch (e: any) {
      setRatingMsg(e?.message || "Noget gik galt");
    } finally {
      setIsSavingRating(false);
    }
  }

  function primaryAction() {
    // din eksisterende flow-logik
    if (onSave) return onSave();
    if (onDone) return onDone();
  }

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <div className={styles.badge}>FINISH</div>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.sub}>{subtitle}</p>

        {/* ✅ Rating block */}
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, opacity: 0.95 }}>
            Hvordan smagte det?
          </div>

          <StarRow value={stars} onChange={setStars} disabled={isSavingRating} />

          {!canRate ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Rating er klar, men mangler <code>variantId</code> + <code>domain</code> fra brew-flowet.
            </div>
          ) : (
            <button
              type="button"
              onClick={saveRating}
              disabled={!canSubmitRating}
              className={styles.secondary}
              style={{ justifySelf: "start" }}
            >
              {isSavingRating ? "Gemmer..." : "Gem rating"}
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