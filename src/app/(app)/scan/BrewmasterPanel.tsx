"use client";

import styles from "./BrewmasterPanel.module.css";

type Match = {
  brand: string;
  line?: string | null;
  name: string;
  size_g?: number | null;
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
  confidence: number; // 0..1
  match?: Match | null;
  brew?: Brew | null;
  origin?: any | null;
  dna?: any | null;
  missingText?: string | null;
};

function clamp(n: number, a = 0, b = 1) {
  return Math.max(a, Math.min(b, n));
}

function labelConfidence(c: number) {
  if (c >= 0.9) return "Høj";
  if (c >= 0.75) return "God";
  if (c >= 0.6) return "Medium";
  return "Lav";
}

function to10(n?: number | null) {
  if (n == null) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function scoreFromMatch(m?: Match | null) {
  // Heuristik (MVP) — brug det vi HAR
  const intensity = to10(m?.intensity);
  const arabica = m?.arabica_pct ?? null;
  const form = m?.form ?? null;

  // bitterness ~ intensity + robusta-ish
  let bitterness = intensity ?? 5;
  if (arabica != null) {
    // lav arabica => mere bite
    bitterness += arabica >= 90 ? -1 : arabica >= 70 ? 0 : 1;
  }
  bitterness = Math.max(1, Math.min(10, bitterness));

  // body ~ intensity (men lidt højere ved lav arabica)
  let body = (intensity ?? 5);
  if (arabica != null) body += arabica >= 90 ? 0 : 1;
  body = Math.max(1, Math.min(10, body));

  // clarity ~ højere arabica + hele bønner
  let clarity = 6;
  if (arabica != null) clarity = arabica >= 90 ? 8 : arabica >= 70 ? 6 : 5;
  if (form === "beans") clarity += 1;
  if (form === "ground") clarity -= 1;
  clarity = Math.max(1, Math.min(10, clarity));

  return { bitterness, body, clarity };
}

function barLabel(n: number) {
  if (n >= 8) return "Høj";
  if (n >= 5) return "Mellem";
  return "Lav";
}

export default function BrewmasterPanel({
  confidence,
  match,
  brew,
  origin,
  dna,
  missingText,
}: Props) {
  const c = clamp(confidence);
  const confPct = Math.round(c * 100);
  const confLabel = labelConfidence(c);

  const scores = scoreFromMatch(match);

  const title = match
    ? `${match.brand} ${match.line ? `${match.line} ` : ""}${match.name}`
    : "Ingen sikker match endnu";

  const quickFacts: { k: string; v: string }[] = [];
  if (match?.size_g != null) quickFacts.push({ k: "Størrelse", v: `${match.size_g}g` });
  if (match?.form) quickFacts.push({ k: "Form", v: match.form });
  if (match?.arabica_pct != null) quickFacts.push({ k: "Arabica", v: `${match.arabica_pct}%` });
  if (match?.organic != null) quickFacts.push({ k: "Organic", v: match.organic ? "Ja" : "Nej" });

  const insights: string[] = [];
  if (match?.intensity != null) {
    if (match.intensity >= 8)
      insights.push("Den her ligger i den kraftige ende. Hvis den bliver harsh: grovere grind eller 1–2°C lavere temp.");
    else if (match.intensity <= 4)
      insights.push("Mild profil. Hvis du savner punch: finere grind eller lidt højere dose.");
    else insights.push("All-round profil. Brug grind som din primære finjustering.");
  }
  if (match?.form === "beans") insights.push("Hele bønner: kværn lige før bryg for markant bedre aroma.");
  if (match?.form === "ground") insights.push("Formalet: opbevar lufttæt/mørkt — smag falder hurtigt efter åbning.");

  return (
    <section className={styles.wrap} aria-label="Brewmaster">
      <div className={styles.topRow}>
        <div className={styles.badge}>Brewmaster</div>

        <div className={styles.conf}>
          <div className={styles.confTop}>
            <span>Confidence</span>
            <b>
              {confLabel} · {confPct}%
            </b>
          </div>
          <div className={styles.meter}>
            <div className={styles.meterFill} style={{ width: `${confPct}%` }} />
          </div>
        </div>
      </div>

      <div className={styles.title}>{title}</div>

      {quickFacts.length > 0 && (
        <div className={styles.facts}>
          {quickFacts.map((f) => (
            <div key={f.k} className={styles.fact}>
              <span>{f.k}</span>
              <b>{f.v}</b>
            </div>
          ))}
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Taste profile</div>

          <div className={styles.profileRow}>
            <div className={styles.profileLabel}>Bitterness</div>
            <div className={styles.profileBar}>
              <div className={styles.profileFill} style={{ width: `${scores.bitterness * 10}%` }} />
            </div>
            <div className={styles.profileValue}>{barLabel(scores.bitterness)}</div>
          </div>

          <div className={styles.profileRow}>
            <div className={styles.profileLabel}>Body</div>
            <div className={styles.profileBar}>
              <div className={styles.profileFill} style={{ width: `${scores.body * 10}%` }} />
            </div>
            <div className={styles.profileValue}>{barLabel(scores.body)}</div>
          </div>

          <div className={styles.profileRow}>
            <div className={styles.profileLabel}>Clarity</div>
            <div className={styles.profileBar}>
              <div className={styles.profileFill} style={{ width: `${scores.clarity * 10}%` }} />
            </div>
            <div className={styles.profileValue}>{barLabel(scores.clarity)}</div>
          </div>

          <div className={styles.profileHint}>
            (MVP) Vi estimerer ud fra posens data. Bliver skarpere når DNA/origin udfyldes.
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Best brew right now</div>

          {brew ? (
            <>
              <div className={styles.brewLine}>
                <b>{brew.method}</b> · Grind: {brew.grind} · Ratio: {brew.ratio} · Temp: {brew.temp_c}°C
              </div>
              {brew.notes ? <div className={styles.brewNotes}>{brew.notes}</div> : null}
            </>
          ) : (
            <div className={styles.empty}>Ingen bryg-anbefaling endnu for denne variant.</div>
          )}

          {insights.length ? (
            <ul className={styles.insights}>
              {insights.slice(0, 3).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Knowledge base</div>

        <div className={styles.krow}>
          <div className={styles.klabel}>Origin</div>
          <div className={styles.kvalue}>{origin ? JSON.stringify(origin) : "— ikke sat endnu"}</div>
        </div>

        <div className={styles.krow}>
          <div className={styles.klabel}>Smags-DNA</div>
          <div className={styles.kvalue}>{dna ? JSON.stringify(dna) : "— ikke sat endnu"}</div>
        </div>

        {missingText ? <div className={styles.missing}>{missingText}</div> : null}
      </div>
    </section>
  );
}