// src/lib/scan/ocrExtract.ts 
type Extracted = {
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

function cleanText(s: string) {
  return (s || "")
    .replace(/\u00ad/g, "") // soft hyphen
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickBrand(t: string) {
  const T = t.toUpperCase();
  const brands = ["LAVAZZA", "ILLY", "SEGAFREDO", "GEVALIA", "STARBUCKS", "JACOBS"];
  const hit = brands.find((b) => T.includes(b));
  return hit ? hit[0] + hit.slice(1).toLowerCase() : undefined;
}

function pickSizeG(t: string) {
  const m = t.match(/(\d{2,4})\s*(g|gr)\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  if (n < 10 || n > 5000) return undefined;
  return n;
}

function pickIntensity(t: string) {
  // fx "6/10", "Intensity 6", "INTENSITÀ 6"
  const m =
    t.match(/(\d{1,2})\s*\/\s*10\b/i) ||
    t.match(/\bintensit(?:y|à|a)\b[^\d]{0,10}(\d{1,2})\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 12) return undefined;
  return n;
}

function pickArabicaPct(t: string) {
  const m = t.match(/(\d{2,3})\s*%\s*arabica/i) || t.match(/\b100\s*%\b/i);
  if (!m) return undefined;
  const n = Number(m[1] ?? 100);
  if (!Number.isFinite(n) || n < 10 || n > 100) return undefined;
  return n;
}

function pickOrganic(t: string) {
  const T = t.toLowerCase();
  if (T.includes("organic") || T.includes("bio") || T.includes("økolog")) return true;
  return undefined;
}

function pickNameAndLine(t: string) {
  // meget simpel: kig efter kendte tokens
  const T = t.toUpperCase();

  const line = T.includes("TIERRA") ? "Tierra!" : undefined;

  // navne-kandidat: "BIO-ORGANIC" / "BIO ORGANIC"
  let name: string | undefined;
  if (T.includes("BIO-ORGANIC") || T.includes("BIO ORGANIC")) name = "Bio-Organic";

  return { line, name };
}

export async function ocrExtractFromImageFile(file: File): Promise<Extracted> {
  // Dynamisk import så Next ikke prøver at bundle det til server
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker("eng");
  try {
    const url = URL.createObjectURL(file);
    try {
      const { data } = await worker.recognize(url);
      const raw = cleanText(data?.text || "");
      const { line, name } = pickNameAndLine(raw);

      return {
        brand: pickBrand(raw),
        line,
        name,
        size_g: pickSizeG(raw),
        intensity: pickIntensity(raw),
        arabica_pct: pickArabicaPct(raw),
        organic: pickOrganic(raw),
        // form/ ean kan vi ikke stole på endnu fra OCR her
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    await worker.terminate();
  }
}