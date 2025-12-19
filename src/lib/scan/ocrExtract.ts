import Tesseract from "tesseract.js"; 

type Extracted = {
  brand?: string;
  line?: string;
  name?: string;
  size_g?: number;
  form?: "beans" | "ground";
  organic?: boolean;
  ean?: string;
};

const STOP = new Set([
  "coffee","espresso","caffe","café","roast","roasted","beans","ground",
  "arabica","robusta","blend","intensity","strength",
  "organic","bio","økologisk","øko",
  "net","weight","g","gram",
  "lavazza" // <- NEJ! fjern ikke brand. (Beholder som eksempel nedenfor)
]);

function normalizeLine(s: string) {
  return s
    .replace(/[|•·•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSizeG(text: string): number | undefined {
  const m = text.match(/(\d{2,4})\s*(g|gram)\b/i);
  if (!m) return;
  const n = Number(m[1]);
  if (Number.isFinite(n)) return n;
}

function looksOrganic(text: string): boolean | undefined {
  if (/\b(organic|bio|økologisk|øko)\b/i.test(text)) return true;
}

function pickEan(text: string): string | undefined {
  const m = text.match(/\b(\d{8}|\d{12,14})\b/);
  return m?.[1];
}

function scoreCandidate(s: string) {
  // score højt hvis det ligner “produktnavn”: få tal, rimelig længde, ikke kun generiske ord
  const hasDigits = /\d/.test(s);
  const words = s.split(" ").filter(Boolean);
  if (words.length === 0) return 0;
  let score = 0;
  if (!hasDigits) score += 2;
  if (s.length >= 6) score += 2;
  if (s.length >= 10) score += 1;
  if (words.length <= 6) score += 1;
  // straf hvis linjen er “for teknisk”
  if (/\b(net|weight|ingredients|made|pack|since|established)\b/i.test(s)) score -= 2;
  return score;
}

function bestLine(lines: string[]) {
  let best = "";
  let bestScore = -999;
  for (const l of lines) {
    const s = normalizeLine(l);
    if (!s) continue;
    const sc = scoreCandidate(s);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  return best || "";
}

function guessBrand(lines: string[]) {
  // Brand er ofte 1 ord, ALL CAPS / Titlecase, tidligt i teksten
  const top = lines.slice(0, 8).map(normalizeLine).filter(Boolean);

  // hardcoded “starter pack” (B1). Udvid senere.
  const known = ["Lavazza", "Illy", "Segafredo", "Gevalia", "Merrild", "Starbucks"];
  for (const k of known) {
    if (top.some(l => new RegExp(`\\b${k}\\b`, "i").test(l))) return k;
  }

  // fallback: første “pæne” 1-2 ord linje uden tal
  for (const l of top) {
    if (/\d/.test(l)) continue;
    const w = l.split(" ").filter(Boolean);
    if (w.length === 1 && w[0].length >= 4) return w[0];
    if (w.length === 2 && w.join(" ").length <= 16) return w.join(" ");
  }

  return undefined;
}

function guessLineAndName(lines: string[], brand?: string) {
  const cleaned = lines.map(normalizeLine).filter(Boolean);

  // Fjern linjer der kun er størrelse, ean, osv.
  const candidates = cleaned.filter((l) => {
    if (/\b(\d{8}|\d{12,14})\b/.test(l)) return false;
    if (/\b\d{2,4}\s*(g|gram)\b/i.test(l)) return false;
    if (/ingredients|net weight|weight|www\./i.test(l)) return false;
    return true;
  });

  // Hvis brand findes, prioriter linjer der indeholder brand/ligger tæt på top
  const top = candidates.slice(0, 12);

  // “Line” er tit med tegn/udråbstegn (Tierra!) eller kort “serie-navn”
  let line: string | undefined;
  let name: string | undefined;

  // Case: “Tierra!” “Qualità Rossa” etc: linje med specialtegn eller kort phrase
  for (const l of top) {
    if (brand && new RegExp(`\\b${brand}\\b`, "i").test(l)) continue;
    if (/[!™®]/.test(l) && l.length <= 22) { line = l; break; }
  }

  // Name: bedste “produkt-linje”
  const best = bestLine(top.filter(l => (brand ? !new RegExp(`\\b${brand}\\b`, "i").test(l) : true)));
  if (best) name = best;

  // Hvis name == line, så drop line
  if (line && name && line.toLowerCase() === name.toLowerCase()) line = undefined;

  // Sanity: hvis name kun 1 ord og == brand-ish, drop
  if (name && brand && name.toLowerCase() === brand.toLowerCase()) name = undefined;

  return { line, name };
}

export async function ocrExtractFromImageFile(
  file: File
): Promise<{ extracted: Extracted; ocr_text: string; ocr_confidence?: number }> {
  const { data } = await Tesseract.recognize(file, "eng", { logger: () => {} });

  const text = (data?.text ?? "").replace(/\s+/g, " ").trim();
  const lines = (data?.lines ?? [])
    .map((x: any) => (x?.text ? String(x.text) : ""))
    .filter(Boolean);

  const raw = text;
  const size_g = pickSizeG(raw);
  const organic = looksOrganic(raw);
  const ean = pickEan(raw);

  const brand = guessBrand(lines) ?? (ean ? undefined : undefined);
  const { line, name } = guessLineAndName(lines, brand);

  // Form er svær: default beans hvis “beans” ses, ellers ground hvis “ground”
  let form: Extracted["form"] | undefined;
  if (/\bbeans\b/i.test(raw)) form = "beans";
  if (/\bground\b/i.test(raw)) form = "ground";

  const extracted: Extracted = {
    brand,
    line,
    name,
    size_g,
    organic,
    ean,
    form,
  };

  const confidence = typeof data?.confidence === "number" ? data.confidence : undefined;

  return { extracted, ocr_text: raw, ocr_confidence: confidence };
}