"use client";

import styles from "./BrewmasterInsight.module.css";

type Match = {
  brand: string;
  line?: string | null;
  name: string;
  form?: string | null;
  intensity?: number | null;
  arabica_pct?: number | null;
  organic?: boolean | null;
};

type Brew = {
  method: string;
  grind: string;
  ratio: string;
  temp_c: number;
  notes?: string;
};

type Props = {
  match: Match | null;
  brew: Brew | null;
  origin: any | null;
  dna: any | null;
  confidence: number;
  isRefreshing?: boolean;
};

/** prøver at finde smagsfelter i dna, uden at kende schema 100% */
function pick10(dna: any, key: string): number | null {
  if (!dna || typeof dna !== "object") return null;
  const v = dna[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    // accepter både 1-10 og 0-1 (normaliser)
    if (v >= 1 && v <= 10) return v;
    if (v >= 0 && v <= 1) return Math.round(v * 10);
  }
  return null;
}

function formatName(m: Match) {
  return `${m.brand}${m.line ? ` ${m.line}` : ""} ${m.name}`.trim();
}

export default function BrewmasterInsight({
  match,
  brew,
  origin,
  dna,
  confidence,
  isRefreshing,
}: Props) {
  if (!match) return null;

  const dnaBitterness = pick10(dna, "bitterness");
  const dnaBody = pick10(dna, "body");
  const dnaClarity = pick10(dna, "clarity");

  const title = formatName(match);

  // --- 1) Autoritativ 3-linjers dom ---
  const method = brew?.method ?? "Filter / Pour over";
  const temp = brew?.temp_c ?? 93;

  const tasteLine =
    dnaBitterness || dnaBody || dnaClarity
      ? `Forvent ${dnaBody ? `body ${dnaBody}/10` : "medium body"}, ${dnaBitterness ? `bitterhed ${dnaBitterness}/10` : "balanceret bitterhed"} og ${dnaClarity ? `klarhed ${dnaClarity}/10` : "pæn klarhed"}.`
      : match.intensity != null
      ? match.intensity >= 8
        ? "Forvent en kraftig kop. Den tåler små fejl — men kan blive harsh ved for høj temp."
        : match.intensity <= 4
        ? "Forvent en mild kop. Små justeringer i grind/ratio giver mere punch."
        : "Forvent en balanceret kop. Grind er din vigtigste justeringsknap."
      : "Forvent en balanceret kop. Grind er din vigtigste justeringsknap.";

  const tempLine =
    match.intensity != null && match.intensity >= 8
      ? `Tip: Start ved ${Math.max(90, temp - 1)}–${temp}°C. Høj intensitet bliver ofte bedre lidt lavere.`
      : match.intensity != null && match.intensity <= 4
      ? `Tip: Start ved ${temp}–${Math.min(96, temp + 1)}°C. Mild kaffe kan løftes med lidt mere varme.`
      : `Tip: Start ved ${temp}°C. Justér 1–2°C før du ændrer alt andet.`;

  // --- 2) “What you didn’t know” ---
  const aha: string[] = [];

  if (match.arabica_pct != null) {
    if (match.arabica_pct >= 90) aha.push("Høj Arabica → typisk mere aroma/sødme og mindre ‘kant’ end blends med robusta.");
    else aha.push("Arabica < 90% → ofte mere ‘bite’ og en mere robust crema-følelse (robusta i mixet).");
  }

  if (match.form === "ground") aha.push("Formalet kaffe falder hurtigere i smag efter åbning — lufttæt og mørkt gør en reel forskel.");
  if (match.form === "beans") aha.push("Hele bønner: den største ‘gratis’ opgradering er at kværne lige før bryg.");

  if (origin && typeof origin === "object") {
    const region = origin.region || origin.country || origin.origin || null;
    if (region) aha.push(`Origin påvirker smagsprofilen mere end mange tror — især hvis den går igen på tværs af brands.`);
  }

  // hold det kort
  const ahaLine = aha[0] ?? "Vi lærer hurtigere når flere rater — og anbefalingerne bliver mærkbart skarpere.";

  // --- 3) status / credibility ---
  const confPct = Math.round((confidence ?? 0) * 100);
  const statusText =
    confPct >= 90 ? "Høj sikkerhed" : confPct >= 75 ? "God sikkerhed" : "Lavere sikkerhed";

  return (
    <section className={styles.wrap} aria-label="Brewmaster insight">
      <div className={styles.head}>
        <div className={styles.badge}>BREWMASTER</div>
        <div className={styles.title}>{title}</div>
        <div className={styles.meta}>
          <span>{statusText}</span>
          <span className={styles.dot}>•</span>
          <span>{confPct}% match</span>
          {isRefreshing ? (
            <>
              <span className={styles.dot}>•</span>
              <span className={styles.refresh}>Opdaterer viden…</span>
            </>
          ) : null}
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.kicker}>Konklusion</div>
        <div className={styles.line}>
          Matcher bedst: <b>{method}</b>
        </div>
        <div className={styles.line}>{tasteLine}</div>
        <div className={styles.lineMuted}>{tempLine}</div>
      </div>

      <div className={styles.aha}>
        <div className={styles.kicker}>Det du typisk ikke får at vide</div>
        <div className={styles.ahaLine}>{ahaLine}</div>
      </div>
    </section>
  );
}