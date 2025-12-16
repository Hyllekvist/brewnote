import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Extracted = {
  brand?: string;
  line?: string;
  name?: string;
  size_g?: number;
  form?: "beans" | "ground";
  intensity?: number;
  arabica_pct?: number;
  organic?: boolean;
  ean?: string; // senere hvis du scanner barcode
};

export async function POST(req: Request) {
  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // 1) hent session
  const { data: session, error: sErr } = await supabase
    .from("scan_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sErr || !session) {
    return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  }

  // 2) MOCK extract (v1)
  // Skift dette ud med rigtig OCR senere.
  const extracted: Extracted = {
    brand: "Lavazza",
    line: "Tierra!",
    name: "Bio-Organic",
    size_g: 500,
    form: "beans",
    intensity: 6,
    arabica_pct: 100,
    organic: true
  };

  // 3) resolve
  const resolved = await resolveVariant(supabase, extracted);

  const status = resolved ? "resolved" : "needs_user";
  const confidence = resolved ? 0.9 : 0.55;

  // 4) persist
  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      extracted,
      resolved_variant_id: resolved?.variant_id ?? null,
      resolution_confidence: confidence,
      status
    })
    .eq("id", sessionId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return NextResponse.json({
    status,
    sessionId,
    confidence,
    extracted,
    match: resolved ?? null,
    suggestions: resolved ? [] : []
  });
}

async function resolveVariant(supabase: any, ex: Extracted) {
  // A) barcode match (hvis vi får ean senere)
  if (ex.ean) {
    const { data: rows } = await supabase
      .from("product_barcodes")
      .select("variant_id, product_variants(id, size_g, form, intensity, arabica_pct, organic, products(id, brand, line, name))")
      .eq("ean", ex.ean)
      .limit(1);

    const hit = rows?.[0];
    if (hit?.product_variants?.products) {
      const p = hit.product_variants.products;
      const v = hit.product_variants;
      return {
        product_id: p.id,
        variant_id: v.id,
        brand: p.brand,
        line: p.line,
        name: p.name,
        size_g: v.size_g,
        form: v.form,
        intensity: v.intensity,
        arabica_pct: v.arabica_pct,
        organic: v.organic
      };
    }
  }

  // B) fuzzy på product (brand + name)
  const brandQ = ex.brand ? `%${ex.brand}%` : "%";
  const nameQ = ex.name ? `%${ex.name}%` : "%";

  const { data: products } = await supabase
    .from("products")
    .select("id, brand, line, name")
    .ilike("brand", brandQ)
    .ilike("name", nameQ)
    .limit(5);

  if (!products?.length) return null;

  // C) vælg første product (MVP)
  const p = products[0];

  // D) find variant der matcher size/form bedst
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, size_g, form, intensity, arabica_pct, organic")
    .eq("product_id", p.id)
    .limit(25);

  if (!variants?.length) return null;

  const best =
    variants.find((v: any) => (ex.size_g ? v.size_g === ex.size_g : true) && (ex.form ? v.form === ex.form : true)) ??
    variants[0];

  return {
    product_id: p.id,
    variant_id: best.id,
    brand: p.brand,
    line: p.line,
    name: p.name,
    size_g: best.size_g,
    form: best.form,
    intensity: best.intensity,
    arabica_pct: best.arabica_pct,
    organic: best.organic
  };
}