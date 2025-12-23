"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./TasteClient.module.css";

type Domain = "coffee" | "tea";

type ProfileResp = {
  ok: boolean;
  domain: Domain;
  mu: any | null;
  sigma: any | null;
  beta?: number | null;
  updated_at?: string | null;

  confidence_count: number;

  sensitivity: {
    acidity_sigma: number;
    bitterness_sigma: number;
    most_sensitive: "acidity" | "bitterness" | null;
  };
};

const MIN_CONF_FOR_PROFILE_LOCK = 3;

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

  const axes = useMemo(() => {
    const base = [
      { key: "b", label: "Bitterness" },
      { key: "a", label: "Acidity" },
      { key: "s", label: "Sweetness" },
      { key: "m", label: "Body" },
      { key: "r", label: "Aroma" },
      { key: "c", label: "Clarity" },
    ];
    if (domain === "tea") {
      return [...base, { key: "t", label: "Astringency" }];
    }
    return base;
  }, [domain]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/profile/domain?domain=${domain}`, { method: "GET" });
        const json = (await res.json().catch(() => ({}))) as ProfileResp;

        if (!res.ok || !json?.ok) {
          throw new Error((json as any)?.error || `HTTP ${res.status}`);
        }

        if (alive) setData(json);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Kunne ikke hente profil");
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [domain]);

  const confN = data?.confidence_count ?? 0;
  const isColdStart = confN < MIN_CONF_FOR_PROFILE_LOCK;

  const confidenceLabel = useMemo(() => {
    const n = confN;
    if (n >= 12) return "High";
    if (n >= 5) return "Medium";
    if (n >= 1) return "Low";
    return "None";
  }, [confN]);

  const confidenceHelp = useMemo(() => {
    if (confN <= 0) return "Giv din første rating for at starte din smagsprofil.";
    if (confN < MIN_CONF_FOR_PROFILE_LOCK) {
      const left = MIN_CONF_FOR_PROFILE_LOCK - confN;
      return `Foreløbig profil – giv ${left} rating${left === 1 ? "" : "s"} mere for at låse din smag fast.`;
    }
    return "Profilen er aktiv – vi finjusterer med hver rating.";
  }, [confN]);

  const sensitivityLine = useMemo(() => {
    const s = data?.sensitivity;
    if (!s) return null;

    if (isColdStart || !s.most_sensitive) {
      return "Vi lærer stadig hvad du er mest følsom overfor.";
    }

    return s.most_sensitive === "acidity"
      ? "Du er mest følsom overfor: acidity"
      : "Du er mest følsom overfor: bitterness";
  }, [data?.sensitivity, isColdStart]);

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

      {!loading && !err ? (
        <>
          <section className={styles.card}>
            <div className={styles.row}>
              <div className={styles.kicker}>CONFIDENCE</div>
              <div className={styles.pill}>
                {confidenceLabel} · {confN} rating{confN === 1 ? "" : "s"}
              </div>
            </div>

            <div className={styles.sub}>{confidenceHelp}</div>
            <div className={styles.sub} style={{ marginTop: 6 }}>
              {sensitivityLine}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.kicker}>PROFILE</div>

            <div
              className={styles.sliders}
              style={isColdStart ? { opacity: 0.78 } : undefined}
            >
              {axes.map((ax) => {
                // fallback lidt mindre “død 50%” – men stadig neutral
                const fallback = ax.key === "s" ? 0.4 : 0.5;
                const v = readMu(data?.mu, ax.key, fallback);

                return (
                  <div key={ax.key} className={styles.sliderRow}>
                    <div className={styles.sliderTop}>
                      <span className={styles.sliderLabel}>{ax.label}</span>
                      <span className={styles.sliderVal}>{pct(v)}%</span>
                    </div>
                    <div className={styles.track}>
                      <div className={styles.fill} style={{ width: `${pct(v)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {isColdStart ? (
              <div className={styles.sub} style={{ marginTop: 10 }}>
                Vi viser en foreløbig baseline indtil vi har nok datapunkter.
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}