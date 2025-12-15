"use client";

import Image from "next/image";
import styles from "./ProductScreen.module.css";

export type BrewPreset = {
  id: string;
  label: string; // Espresso / Pour-over / Cold brew
  sub: string;   // "Fyldig" / "Balanceret" ...
  brewTime: string; // "2:45"
  methodKey: "espresso" | "pourover" | "coldbrew" | "tea";
  dnaMini?: { acid: number; body: number; sweet: number };
};

export type ProductScreenProps = {
  title: string;
  subtitle: string; // fx "Rødvin fra Toscana" -> her: "Coffee • Colombia" etc.
  imageUrl?: string;
  imageAlt?: string;

  dna: { acid: number; body: number; sweet: number };

  primaryCta: {
    label: string; // "BRYG NU"
    hint: string;  // "Anbefalet opskrift • 2:45"
    href: string;  // "/brew?product=..."
  };

  presets: BrewPreset[];
  tasteChips: { label: string; count?: number }[];

  secondary: {
    addToBarHref?: string;
    reviewsHref?: string;
    editHref?: string;
  };
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function BrewDnaGlyph({
  acid,
  body,
  sweet,
  size = 118,
}: {
  acid: number;
  body: number;
  sweet: number;
  size?: number;
}) {
  // Radial “fingerprint-ish” glyph. Simple + iconic.
  const a = clamp01(acid);
  const b = clamp01(body);
  const s = clamp01(sweet);

  const r1 = 34 + a * 18;
  const r2 = 34 + b * 18;
  const r3 = 34 + s * 18;

  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="Brew DNA"
      className={styles.dnaSvg}
    >
      <defs>
        <radialGradient id="dnaGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="var(--accent2)" stopOpacity="0.55" />
          <stop offset="60%" stopColor="var(--accent1)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={size * 0.48} fill="url(#dnaGlow)" />

      <g fill="none" strokeWidth="3">
        <circle
          cx={cx}
          cy={cy}
          r={r1}
          stroke="var(--accent1)"
          strokeOpacity="0.95"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r2}
          stroke="var(--accent2)"
          strokeOpacity="0.85"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r3}
          stroke="var(--accent1)"
          strokeOpacity="0.65"
        />

        {/* subtle “fingerprint” arcs */}
        <path
          d={`M ${cx - 26} ${cy - 6} C ${cx - 10} ${cy - 22}, ${cx + 10} ${cy - 22}, ${cx + 26} ${cy - 6}`}
          stroke="rgba(255,255,255,0.18)"
        />
        <path
          d={`M ${cx - 30} ${cy + 8} C ${cx - 8} ${cy - 2}, ${cx + 8} ${cy - 2}, ${cx + 30} ${cy + 8}`}
          stroke="rgba(255,255,255,0.12)"
        />
        <path
          d={`M ${cx - 26} ${cy + 22} C ${cx - 10} ${cy + 8}, ${cx + 10} ${cy + 8}, ${cx + 26} ${cy + 22}`}
          stroke="rgba(255,255,255,0.10)"
        />
      </g>
    </svg>
  );
}

function DnaMini({ dna }: { dna: { acid: number; body: number; sweet: number } }) {
  return (
    <div className={styles.dnaMini}>
      <BrewDnaGlyph acid={dna.acid} body={dna.body} sweet={dna.sweet} size={68} />
    </div>
  );
}

export function ProductScreen(props: ProductScreenProps) {
  const { title, subtitle, imageUrl, imageAlt, dna, primaryCta, presets, tasteChips, secondary } =
    props;

  return (
    <div className={styles.page}>
      {/* HERO */}
      <header className={styles.hero}>
        <div className={styles.heroBg} />

        <div className={styles.heroMedia}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt || title}
              fill
              priority
              className={styles.heroImg}
              sizes="(max-width: 640px) 100vw, 640px"
            />
          ) : (
            <div className={styles.heroFallback} />
          )}
          <div className={styles.heroVignette} />
        </div>

        <div className={styles.heroText}>
          <div className={styles.kicker}>{subtitle}</div>
          <h1 className={styles.h1}>{title}</h1>
        </div>
      </header>

      {/* DNA + CTA */}
      <section className={styles.core}>
        <div className={styles.dnaCard}>
          <div className={styles.dnaTop}>
            <div>
              <div className={styles.dnaTitle}>Brew DNA</div>
              <div className={styles.dnaSub}>Tap for detaljer</div>
            </div>
            <BrewDnaGlyph acid={dna.acid} body={dna.body} sweet={dna.sweet} />
          </div>

          <div className={styles.dnaLegend}>
            <span className={styles.legendDot} />
            <span>Syre</span>
            <span className={styles.sep}>•</span>
            <span>Krop</span>
            <span className={styles.sep}>•</span>
            <span>Sødme</span>
          </div>
        </div>

        <a className={styles.primaryCta} href={primaryCta.href}>
          <div className={styles.primaryLabel}>{primaryCta.label}</div>
          <div className={styles.primaryHint}>{primaryCta.hint}</div>
        </a>
      </section>

      {/* PRESETS */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Brew presets</h2>
          <div className={styles.sectionSub}>Kun de bedste – ingen støj.</div>
        </div>

        <div className={styles.presetRow}>
          {presets.slice(0, 3).map((p) => (
            <a key={p.id} className={styles.presetCard} href={`${primaryCta.href}&preset=${p.id}`}>
              <div className={styles.presetTop}>
                <div>
                  <div className={styles.presetLabel}>{p.label}</div>
                  <div className={styles.presetSub}>{p.sub}</div>
                </div>
                <div className={styles.presetTime}>{p.brewTime}</div>
              </div>

              {p.dnaMini ? <DnaMini dna={p.dnaMini} /> : <div className={styles.presetGhost} />}
            </a>
          ))}
        </div>
      </section>

      {/* TASTE CHIPS */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Smagsnoter folk nævner</h2>
        </div>

        <div className={styles.chips}>
          {tasteChips.slice(0, 10).map((t) => (
            <span key={t.label} className={styles.chip}>
              {t.label}
              {typeof t.count === "number" ? <span className={styles.chipCount}>{t.count}</span> : null}
            </span>
          ))}
        </div>

        <div className={styles.secondaryRow}>
          {secondary.addToBarHref ? (
            <a className={styles.secondaryBtn} href={secondary.addToBarHref}>
              Tilføj til Bar
            </a>
          ) : null}
          {secondary.reviewsHref ? (
            <a className={styles.secondaryBtn} href={secondary.reviewsHref}>
              Reviews
            </a>
          ) : null}
          {secondary.editHref ? (
            <a className={styles.secondaryBtn} href={secondary.editHref}>
              Rediger
            </a>
          ) : null}
        </div>
      </section>

      <div className={styles.bottomFade} />
    </div>
  );
}
