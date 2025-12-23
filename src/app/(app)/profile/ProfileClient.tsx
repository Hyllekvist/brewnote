"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ProfileClient.module.css";

type Domain = "coffee" | "tea";

type Vec = Partial<Record<string, number>>;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
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

function prettyAxis(k: string) {
  const map: Record<string, string> = {
    b: "Bitterness",
    a: "Acidity",
    s: "Sweetness",
    m: "Mouthfeel",
    r: "Roast",
    c: "Clarity",
    t: "Tannins",
  };
  return map[k] || k.toUpperCase();
}

function confidenceFromCount(n: number) {
  // enkel, ærlig v1
  const pct = Math.max(0, Math.min(100, Math.round(n * 10)));
  const label = n >= 10 ? "High" : n >= 3 ? "Medium" : "Low";
  return { pct, label };
}

export default function ProfileClient() {
  const [domain, setDomain] = useState<Domain>("coffee");
  const [loading, setLoading] = useState(true);
  const [mu, setMu] = useState<Vec | null>(null);
  const [sigma, setSigma] = useState<Vec | null>(null);
  const [count, setCount] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  const keys = useMemo(() => {
    return domain === "tea"
      ? (["b", "a", "s", "m", "r", "c", "t"] as const)
      : (["b", "a", "s", "m", "r", "c"] as const);
  }, [domain]);

  const conf = useMemo(() => confidenceFromCount(count), [count]);

  // “følsomhed”: lav sigma => stærkere/skarper preference => mere følsom
  const sensitiveLabel = useMemo(() => {
    if (!sigma) return null;

    const candidates = ["a", "b"]; // du bad eksplicit om acidity/bitterness
    let bestKey: string | null = null;
    let bestScore = -Infinity;

    for (const k of candidates) {
      const s = Number(sigma[k]);
      if (!Number.isFinite(s)) continue;

      // inverse uncertainty = “sensitivity”
      const sens = 1 / Math.max(0.05, s);
      if (sens > bestScore) {
        bestScore = sens;
        bestKey = k;
      }
    }

    return bestKey ? prettyAxis(bestKey) : null;
  }, [sigma]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const qs = new URLSearchParams({ domain });
        const res = await fetch(`/api/profile/domain?${qs.toString()}`, { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.ok) throw new Error(json?.error || "Kunne ikke hente profil");

        if (cancelled) return;

        setMu(json.mu ?? null);
        setSigma(json.sigma ?? null);
        setCount(Number(json.count ?? 0) || 0);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Noget gik galt");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [domain]);

  const hasProfile = !!mu;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>PROFILE</div>
          <h1 className={styles.h1}>Din smag ({domain})</h1>
          <div className={styles.sub}>Baseret på dine ratings</div>
        </div>

        <div className={styles.segment}>
          <button
            type="button"
            className={domain === "coffee" ? styles.segOn : styles.segOff}
            onClick={() => setDomain("coffee")}
          >
            Coffee
          </button>
          <button
            type="button"
            className={domain === "tea" ? styles.segOn : styles.segOff}
            onClick={() => setDomain("tea")}
          >
            Tea
          </button>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.row}>
          <div className={styles.rowLeft}>
            <div className={styles.rowTitle}>Confidence</div>
            <div className={styles.rowSub}>
              {count} ratings · {conf.label}
            </div>
          </div>
          <div className={styles.pill}>{conf.pct}%</div>
        </div>

        <div className={styles.barWrap} aria-label="Confidence bar">
          <div className={styles.bar} style={{ width: `${conf.pct}%` }} />
        </div>

        <div className={styles.hr} />

        <div className={styles.row}>
          <div className={styles.rowLeft}>
            <div className={styles.rowTitle}>Mest følsom overfor</div>
            <div className={styles.rowSub}>
              {sigma ? "Udledt fra sigma (stabilitet)" : "—"}
            </div>
          </div>
          <div className={styles.pill}>{sensitiveLabel ?? "—"}</div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionTitle}>Preference</div>

        {loading ? (
          <div className={styles.muted}>Henter profil…</div>
        ) : err ? (
          <div className={styles.error}>{err}</div>
        ) : !hasProfile ? (
          <div className={styles.muted}>Ingen profil endnu. Lav 1–2 reviews først.</div>
        ) : (
          <div className={styles.sliders}>
            {keys.map((k) => {
              const v01 = clamp01(Number(mu?.[k] ?? 0.5));
              const v = Math.round(v01 * 100);

              return (
                <div key={k} className={styles.sliderRow}>
                  <div className={styles.sliderTop}>
                    <div className={styles.axis}>{prettyAxis(String(k))}</div>
                    <div className={styles.val}>{v}</div>
                  </div>
                  <input
                    className={styles.range}
                    type="range"
                    min={0}
                    max={100}
                    value={v}
                    readOnly
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}