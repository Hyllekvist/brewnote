"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import styles from "./TasteClient.module.css";

type Domain = "coffee" | "tea";

type ProfileResp = {
  ok: boolean;
  domain: Domain;
  mu: any | null;
  sigma: any | null;
  confidence_count: number;
  sensitivity: {
    acidity_sigma: number;
    bitterness_sigma: number;
    most_sensitive: "acidity" | "bitterness" | null;
  };
  error?: string;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function pct(x: number) {
  return Math.round(clamp01(x) * 100);
}

function readMu(mu: any, key: string, fallback = 0.5) {
  const v = typeof mu?.[key] === "number" ? mu[key] : Number(mu?.[key]);
  return Number.isFinite(v) ? clamp01(v) : fallback;
}

export default function TasteClient() {
  const [domain, setDomain] = useState<Domain>("coffee");
  const [data, setData] = useState<ProfileResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // trigger til refetch (når vi har rated / focus osv.)
  const [tick, setTick] = useState(0);

  const axes = useMemo(
    () => [
      { key: "b", label: "Bitterness" },
      { key: "a", label: "Acidity" },
      { key: "s", label: "Sweetness" },
      { key: "m", label: "Body" },
      { key: "r", label: "Aroma" },
      { key: "c", label: "Clarity" },
    ],
    []
  );

  const fetchProfile = useCallback(async (d: Domain) => {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/profile/domain?domain=${d}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const json = (await res.json().catch(() => ({}))) as ProfileResp;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Kunne ikke hente profil");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // initial + domain change + tick change
  useEffect(() => {
    fetchProfile(domain);
  }, [domain, tick, fetchProfile]);

  // refetch når du kommer tilbage til fanen / app’en
  useEffect(() => {
    function onFocus() {
      setTick((t) => t + 1);
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  // ✅ refetch når rating er gemt i FinishStage
  useEffect(() => {
    function onRated() {
      setTick((t) => t + 1);
    }
    window.addEventListener("brewnote_rating_logged", onRated as EventListener);
    return () => {
      window.removeEventListener("brewnote_rating_logged", onRated as EventListener);
    };
  }, []);

  const confidenceLabel = useMemo(() => {
    const n = data?.confidence_count ?? 0;
    if (n >= 12) return "High";
    if (n >= 5) return "Medium";
    if (n >= 1) return "Low";
    return "None";
  }, [data?.confidence_count]);

  const sensitivityLine = useMemo(() => {
    const n = data?.confidence_count ?? 0;
    if (n < 1) return "Giv din første rating for at starte din smagsprofil.\nVi lærer stadig hvad du er mest følsom overfor.";

    const s = data?.sensitivity;
    if (!s?.most_sensitive) return "Vi lærer stadig hvad du er mest følsom overfor.";
    return s.most_sensitive === "acidity"
      ? "Du er mest følsom overfor: acidity"
      : "Du er mest følsom overfor: bitterness";
  }, [data?.confidence_count, data?.sensitivity]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.title}>Din smag</div>

        <div className={styles.switch}>
          <button
            className={domain === "coffee" ? styles.switchOn : styles.switchOff}
            onClick={() => setDomain("coffee")}
            type="button"
          >
            Coffee
          </button>
          <button
            className={domain === "tea" ? styles.switchOn : styles.switchOff}
            onClick={() => setDomain("tea")}
            type="button"
          >
            Tea
          </button>
        </div>
      </header>

      {loading ? <div className={styles.card}>Loader…</div> : null}
      {err ? <div className={styles.card}>⚠️ {err}</div> : null}

      {!loading && !err && data ? (
        <>
          <section className={styles.card}>
            <div className={styles.row}>
              <div className={styles.kicker}>CONFIDENCE</div>
              <div className={styles.pill}>
                {confidenceLabel} · {data.confidence_count ?? 0} ratings
              </div>
            </div>

            <div className={styles.sub} style={{ whiteSpace: "pre-line" }}>
              {sensitivityLine}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.kicker}>PROFILE</div>

            <div className={styles.sliders}>
              {axes.map((ax) => {
                const v = readMu(data.mu, ax.key, 0.5);
                const p = pct(v);

                return (
                  <div key={ax.key} className={styles.sliderRow}>
                    <div className={styles.sliderTop}>
                      <span className={styles.sliderLabel}>{ax.label}</span>
                      <span className={styles.sliderVal}>{p}%</span>
                    </div>
                    <div className={styles.track}>
                      <div className={styles.fill} style={{ width: `${p}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {((data.confidence_count ?? 0) < 3) ? (
              <div className={styles.sub} style={{ marginTop: 12, opacity: 0.8 }}>
                Vi viser en foreløbig baseline indtil vi har nok datapunkter.
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}