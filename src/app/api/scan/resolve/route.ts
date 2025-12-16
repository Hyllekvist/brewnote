import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Extracted = {
  brand?: string;
  line?: string;
  name?: string;
  size_g?: number;
  form?: "beans" | "ground";
};

type ProductRow = { id: string; brand: string; line: string | null; name: string };
type VariantRow = {
  id: string;
  size_g: number | null;
  form: string | null;
  intensity: number | null;
  arabica_pct: number | null;
  organic: boolean | null;
  products: ProductRow | ProductRow[] | null;
};

function fingerprintFromExtracted(ex: Extracted) {
  const norm = (s?: string) =>
    (s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  return [
    `b:${norm(ex.brand)}`,
    `l:${norm(ex.line)}`,
    `n:${norm(ex.name)}`,
    `s:${ex.size_g ?? ""}`,
    `f:${norm(ex.form)}`,
  ].join("|");
}

export async function POST(req: Request) {
  const { sessionId, variantId } = await req.json();

  if (!sessionId || !variantId) {
    return NextResponse.json(
      { error: "Missing sessionId/variantId" },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();

  // 1) hent session (for extracted -> fingerprint)
  const { data: sess, error: sErr } = await supabase
    .from("scan_sessions")
    .select("id, extracted")
    .eq("id", sessionId)
    .single();

  if (sErr || !sess) {
    return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  }

  const extracted = (sess.extracted ?? {}) as Extracted;
  const fp = fingerprintFromExtracted(extracted);

  // 2) hent variant + product (til UI)
  const { data, error: vErr } = await supabase
    .from("product_variants")
    .select(
      "id, size_g, form, intensity, arabica_pct, organic, products(id, brand, line, name)"
    )
    .eq("id", variantId)
    .single();

  if (vErr || !data) {
    return NextResponse.json({ error: "Unknown variant" }, { status: 404 });
  }

  const v = data as VariantRow;
  const p = Array.isArray(v.products) ? v.products[0] : v.products;

  if (!p) {
    return NextResponse.json({ error: "Variant missing product" }, { status: 400 });
  }

  const match = {
    product_id: p.id,
    variant_id: v.id,
    brand: p.brand,
    line: p.line,
    name: p.name,
    size_g: v.size_g,
    form: v.form,
    intensity: v.intensity,
    arabica_pct: v.arabica_pct,
    organic: v.organic,
  };

  // 3) opdater session til resolved
  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      resolved_variant_id: variantId,
      status: "resolved",
      resolution_confidence: 0.85,
    })
    .eq("id", sessionId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // 4) LÆRING: upsert fingerprint -> variant (kun hvis vi faktisk har data at fingerprinte)
  if (fp.includes("b:") && fp.includes("n:") && fp !== "b:|l:|n:|s:|f:") {
    await supabase.from("scan_fingerprints").upsert(
      { fingerprint: fp, variant_id: variantId },
      { onConflict: "fingerprint" }
    );
  }

  return NextResponse.json({
    status: "resolved",
    sessionId,
    confidence: 0.85,
    match,
  });
}
