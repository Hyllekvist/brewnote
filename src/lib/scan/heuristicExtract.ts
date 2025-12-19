// src/lib/scan/heuristicExtract.ts
export type Extracted = {
  brand?: string;
  line?: string;
  name?: string;
  size_g?: number;
  form?: "beans" | "ground";
  intensity?: number;
  arabica_pct?: number;
  organic?: boolean;
  ean?: string;
};

function norm(s: string) {
  return (s || "")
    .replace(/\u00A0/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFromOcrText(raw: string): Extracted {
  const t = norm(raw).toUpperCase();

  const ex: Extracted = {};

  // --- brand (keyword list – udvid løbende)
  const brands = ["LAVAZZA", "ILLY", "SEGAFREDO", "GEVALIA", "STARBUCKS", "JACOBS"];
  const b = brands.find((x) => t.includes(x));
  if (b) ex.brand = b.charAt(0) + b.slice(1).toLowerCase();

  // --- organic
  if (/\bBIO\b/.test(t) || /\bORGANIC\b/.test(t)) ex.organic = true;

  // --- size (g)
  const size = t.match(/\b(\d{3,4})\s?G\b/);
  if (size) ex.size_g = Number(size[1]);

  // --- form
  if (/\bGROUND\b/.test(t) || /\bMAL(ET|EN)?\b/.test(t)) ex.form = "ground";
  if (/\bBEANS?\b/.test(t) || /\bWHOLE\s?BEAN(S)?\b/.test(t)) ex.form = "beans";

  // --- intensity
  const inten = t.match(/\bINTENSIT(Y|ET)\b.*?(\d{1,2})\s*\/\s*10\b/) || t.match(/\b(\d{1,2})\s*\/\s*10\b/);
  if (inten) ex.intensity = Number(inten[2] ?? inten[1]);

  // --- arabica %
  const arab = t.match(/\b(\d{2,3})\s*%?\s*ARABICA\b/);
  if (arab) ex.arabica_pct = Number(arab[1]);

  // --- line / name (meget groft – men hjælper)
  if (t.includes("TIERRA")) ex.line = "Tierra!";
  if (t.includes("BIO-ORGANIC") || t.includes("BIO ORGANIC")) ex.name = "Bio-Organic";

  // --- EAN (hvis OCR fanger 13 cifre)
  const ean = t.match(/\b(\d{13})\b/);
  if (ean) ex.ean = ean[1];

  // ryd tomme strings
  if (ex.line && !ex.line.trim()) delete ex.line;
  if (ex.name && !ex.name.trim()) delete ex.name;

  return ex;
}