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

type Brew = {
  method: string;
  grind: string;
  ratio: string;
  temp_c: number;
  notes?: string;
};

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

  const bitterness =
    intensity == null ? 5 : Math.max(2, Math.min(9, Math.round(3 + intensity * 0.6)));

  const body =
    intensity == null ? 5 : Math.max(2, Math.min(9, Math.round(3 + intensity * 0.55)));

  const clarity =
    arabica == null ? 6 : Math.max(2, Math.min(9, Math.round(3 + (arabica / 100) * 5)));

  return { bitterness, body, clarity, isEstimated: true };
}

function readDna(dna: any) {
  const b = Number(dna?.bitterness);
  const bo = Number(dna?.body);
  const c = Number(dna?.clarity);

  const ok =
    Number.isFinite(b) &&
    Number.isFinite(bo) &&
    Number.isFinite(c) &&
    b >= 1 &&
    b <= 10 &&
    bo >= 1 &&
    bo <= 10 &&
    c >= 1 &&
    c <= 10;

  if (!ok) return null;
  return { bitterness: b, body: bo, clarity: c, isEstimated: false };
}

function TasteBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(1, Math.min(10, value));
  const w = `${Math.round((clamped / 10) * 100)}%`;

  return (
    <div className={styles.tasteRow}>
      <div className={styles.t