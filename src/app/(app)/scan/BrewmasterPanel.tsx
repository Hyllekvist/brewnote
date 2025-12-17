import styles from "./BrewmasterPanel.module.css";

type Match = {
  product_id: string;
  variant_id: string;
  brand: string;
  name: string;
  line?: string | null;
  size_g?: number | null;
  form?: string | null;
  intensity?: number | null;
  arabica_pct?: number | null;
  organic?: boolean | null;
};

type Brew = { method: string; grind: string; ratio: string; temp_c: number; notes?: string };

type Props = {
  confidence: number; // 0..1
  match: Match | null;
  brew: Brew | null;
  origin: any | null;
  dna: any | null;
  missingText?: string | null;
};

function pct(n: number) {
  const v = Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  return Math.round(v * 100);
}

function labelLevel(v: number) {
  if (v <= 3) return "Lav";
  if (v <= 6) return "Mellem";
  return "Høj";
}

function estimateTaste(match: Match | null) {
  const intensity = match?.intensity ?? null;
  const arabica = match?.arabica_pct ?? null;

  const bitterness = intensity == null ? 5 : Math.max(2, Math.min(9, Math.round(3 + intensity * 0.6)));
  const body = intensity == null ? 5 : Math.max(2, Math.min(9, Math.round(3 + intensity * 0.55)));
  const clarity = arabica == null ? 6 : Math.max(2, Math.min(9, Math.round(3 + (arabica / 100) * 5)));

  return { bitterness, body, clarity, isEstimated: true };
}

function readDna(dna: any) {
  const b = Number(dna?.bitterness);
  const bo = Number(dna?.body);
  const c = Number(dna?.clarity);

  const ok =
    Number.isFinite(b) && Number.isFinite(bo) && Number.isFinite(c) &&
    b >= 1 && b <= 10 && bo >= 1 && bo <= 10 && c >= 1 && c <= 10;

  if (!ok) return null;
  return { bitterness: b, body: bo, clarity: c, isEstimated: false };
}

function Bar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(1, Math.min(10, value));
  const w = `${Math.round((clamped / 10) * 100)}%`;
  return (
    <div className={styles.tasteRow} aria-label={`${label}: ${clamped}/10 (${labelLevel(clamped)})`}>
      <div className={styles.tasteLeft}>{label}</div>

      <div className={styles.tasteBar} role="progressbar" aria-valuemin={1} aria-valuemax={10} aria-valuenow={clamped}>
        <div className={styles.tasteFill} style={{ width: w }} />
        <div className={styles.tasteGlow} aria-hidden="true" style={{ left: w }} />
      </div>

      <div className={styles.tasteRight}>
        <span className={styles.tasteLevel}>{labelLevel(clamped)}</span>
      </div>
    </div>
  );
}

export default function BrewmasterPanel({ confidence, match, brew, origin, dna, missingText }: Props) {
  if (!match) return null;

  const conf = pct(confidence);
  const dnaData = readDna(dna) ?? estimateTaste(match);
  const estNote = dnaData.isEstimated
    ? "MVP · estimeret (bliver skarpere når DNA udfyldes)"
    : "Bygget på ratings (learning)";

  const brandLine = `${match.brand}${match.line ? ` ${match.line}` : ""}`.trim();

  const info = [
    { k: "Størrelse", v: match.size_g ? `${match.size_g}g` : "—" },
    { k: "Form", v: match.form ?? "—" },
    { k: "Arabica", v: match.arabica_pct != null ? `${match.arabica_pct}%` : "—" },
    { k: "Organic", v: match.organic == null ? "—" : match.organic ? "Ja" : "Nej" },
  ];

  return (
    <section className={styles.wrap} aria-label="Brewmaster">
      <div className={styles.topGlow} aria-hidden="true" />

      <header className={styles.head}>
        <div className={styles.pills}>
          <span className={styles.pill}>BREWMASTER</span>
          <span className={styles.pillSoft}>Confidence · {conf}%</span>
        </div>

        <div className={styles.confTrack} aria-hidden="true">
          <div className={styles.confFill} style={{ width: `${conf}%` }} />
        </div>

        <h2 className={styles.title}>
          <span className={styles.titleTop}>{brandLine}</span>
          <span className={styles.titleBottom}>{match.name}</span>
        </h2>
      </header>

      <div className={styles.infoGrid}>
        {info.map((x) => (
          <div key={x.k} className={styles.infoCard}>
            <div className={styles.infoK}>{x.k}</div>
            <div className={styles.infoV}>{x.v}</div>
          </div>
        ))}
      </div>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <div className={styles.blockTitle}>Taste profile</div>
          <div className={styles.blockSub}>{estNote}</div>
        </div>

        <div className={styles.taste}>
          <Bar label="Bitterness" value={dnaData.bitterness} />
          <Bar label="Body" value={dnaData.body} />
          <Bar label="Clarity" value={dnaData.clarity} />
        </div>
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <div className={styles.blockTitle}>Best brew right now</div>
          <div className={styles.blockSub}>Start her — finjustér med grind.</div>
        </div>

        {brew ? (
          <div className={styles.brewHero}>
            <div className={styles.brewMethod}>{brew.method}</div>

            <div className={styles.brewMeta}>
              <span><span className={styles.metaK}>Grind</span> <b>{brew.grind}</b></span>
              <span><span className={styles.metaK}>Ratio</span> <b>{brew.ratio}</b></span>
              <span><span className={styles.metaK}>Temp</span> <b>{brew.temp_c}°C</b></span>
            </div>

            {brew.notes ? <div className={styles.brewNotes}>{brew.notes}</div> : null}
          </div>
        ) : (
          <div className={styles.placeholder}>Ingen brew preset endnu.</div>
        )}
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <div className={styles.blockTitle}>Knowledge base</div>
          <div className={styles.blockSub}>Bygger over tid, én scan ad gangen.</div>
        </div>

        <div className={styles.kb}>
          <div className={styles.kbRow}>
            <span>Origin</span>
            <span className={styles.kbVal}>{origin ? "✓ sat" : "— ikke sat endnu"}</span>
          </div>
          <div className={styles.kbRow}>
            <span>Smags-DNA</span>
            <span className={styles.kbVal}>{dna ? "✓ sat" : "— ikke sat endnu"}</span>
          </div>
        </div>

        {missingText ? <div className={styles.missing}>{missingText}</div> : null}
      </section>
    </section>
  );
}