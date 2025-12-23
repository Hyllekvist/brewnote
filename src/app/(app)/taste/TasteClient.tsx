"use client";
 
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/profile/domain?domain=${domain}`, { method: "GET" });
        const json = (await res.json().catch(() => ({}))) as ProfileResp;
        if (!res.ok || !json?.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`);
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

  const confidenceLabel = useMemo(() => {
    const n = data?.confidence_count ?? 0;
    if (n >= 12) return "High";
    if (n >= 5) return "Medium";
    if (n >= 1) return "Low";
    return "None";
  }, [data?.confidence_count]);

  const sensitivityLine = useMemo(() => {
    const s = data?.sensitivity;
    if (!s) return null;
    if (!s.most_sensitive) return "Vi lærer stadig hvad du er mest følsom overfor.";
    return s.most_sensitive === "acidity"
      ? "Du er mest følsom overfor: acidity"
      : "Du er mest følsom overfor: bitterness";
  }, [data?.sensitivity]);

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
                {confidenceLabel} · {data?.confidence_count ?? 0} ratings
              </div>
            </div>

            <div className={styles.sub}>{sensitivityLine}</div>
          </section>

          <section className={styles.card}>
            <div className={styles.kicker}>PROFILE</div>

            <div className={styles.sliders}>
              {axes.map((ax) => {
                const v = readMu(data?.mu, ax.key, 0.5);
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
          </section>
        </>
      ) : null}
    </main>
  );
}