import { BrowserMultiFormatReader } from "@zxing/browser";

export async function tryExtractEanFromImageFile(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.src = url;
    await new Promise((res, rej) => {
      img.onload = () => res(true);
      img.onerror = () => rej(new Error("Image load failed"));
    });

    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageElement(img);

    URL.revokeObjectURL(url);

    const text = (result?.getText?.() ?? "").trim();
    // EAN er typisk 8/12/13/14 cifre
    if (/^\d{8}(\d{4,6})?$/.test(text)) return text;
    return text || null;
  } catch {
    return null;
  }
}