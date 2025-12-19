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

function pickSizeG(text: string): number | undefined {
  const m = text.match(/(\d{2,4})\s*(g|gram)\b/i);
  if (!m) return;
  const n = Number(m[1]);
  if (Number.isFinite(n)) return n;
}

function looksOrganic(text: string): boolean | undefined {
  if (/\b(organic|bio|økologisk|øko)\b/i.test(text)) return true;
}

export async function ocrExtractFromImageFile(file: File): Promise<Extracted> {
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: () => {},
  });

  const raw = (data?.text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return {};

  // super simple heuristikker (MVP)
  const size_g = pickSizeG(raw);
  const organic = looksOrganic(raw);

  // brand/name/line kan du starte simpelt: tag de “største” ordlinjer senere.
  // Her: lad bruger rette, men giv lidt at arbejde med.
  return {
    size_g,
    organic,
  };
}