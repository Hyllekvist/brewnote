"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./BrewMode.module.css";

type Method = "espresso" | "pourover" | "frenchpress" | "coldbrew" | "gongfu" | "western";

const PRESETS: Record<Method, { label: string; steps: string[]; seconds: number }> = {
  espresso: { label: "Espresso", seconds: 30, steps: ["Forvarm", "Dosér", "Tamp", "Brew 25–35s", "Smag & justér"] },
  pourover: { label: "Pour-over", seconds: 180, steps: ["Skyl filter", "Bloom 30s", "Hæld i pulser", "Vent", "Smag & notér"] },
  frenchpress: { label: "French press", seconds: 240, steps: ["Hæld vand", "Rør let", "Vent 4 min", "Pres langsomt", "Server"] },
  coldbrew: { label: "Cold brew", seconds: 60, steps: ["Bland kaffe + vand", "Sæt på køl 12–16t", "Filtrér", "Smag & fortynd"] },
  gongfu: { label: "Gongfu", seconds: 25, steps: ["Skyl te", "Kort infusion", "Hæld af", "Gentag", "Justér tid pr. infusion"] },
  western: { label: "Western", seconds: 210, steps: ["Dosér", "Hæld vand", "Vent 3–4 min", "Fjern blade", "Smag"] },
};

const pad = (n: number) => String(n).padStart(2, "0");

export function BrewMode() {
  const [method, setMethod] = useState<Method>("pourover");
  const preset = useMemo(() => PRESETS[method], [method]);
  const [t, setT] = useState(preset.seconds);
  const [running, setRunning] = useState(false);

  useEffect(() => { setT(preset.seconds); setRunning(false); }, [preset.seconds]);

  useEffect(() => {
    if (!running) return;
    if (t <= 0) return;
    const id = window.setInterval(() => setT((x) => x - 1), 1000);
    return () => window.clearInterval(id);
  }, [running, t]);

  const mm = Math.max(0, Math.floor(t / 60));
  const ss = Math.max(0, t % 60);

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <div className={styles.title}>Brew Mode</div>
        <select className={styles.select} value={method} onChange={(e) => setMethod(e.target.value as Method)}>
          {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className={styles.timer}>{pad(mm)}:{pad(ss)}</div>

      <div className={styles.controls}>
        <button className={styles.btn} type="button" onClick={() => setRunning((p) => !p)}>{running ? "Pause" : "Start"}</button>
        <button className={styles.btnGhost} type="button" onClick={() => { setT(preset.seconds); setRunning(false); }}>Reset</button>
      </div>

      <div className={styles.steps}>
        {preset.steps.map((s, i) => (
          <div key={i} className={styles.step}>
            <div className={styles.stepNo}>{i + 1}</div>
            <div className={styles.stepText}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
