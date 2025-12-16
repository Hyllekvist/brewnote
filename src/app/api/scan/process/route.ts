import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const { sessionId } = await req.json();
  const supabase = supabaseServer();


  // hent scan session
  const { data: session, error: sErr } = await supabase
    .from("scan_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sErr || !session) {
    return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  }

  // -------- MOCK EXTRACT (v1) --------
  // Du skifter det her ud med rigtig vision/OCR senere.
  const extracted = {
    brand: "Lavazza",
    line: "Tierra!",
    name: "Bio-Organic",
    size_g: 500,
    form: "beans",
    intensity: 6,
    arabica_pct: 100,
    organic: true,
  };

  // resolve mod DB
  const match = await resolveVariant(supabase, extracted);

  const status = match ? "resolved" : "needs_user";
  const confidence = match ? 0.9 : 0.5;

  await supabase.from("scan_sessions").update({
    extracted,
    resolved_variant_id: match?.variant_id ?? null,
    resolution_confidence: confidence,
    status,
  }).eq("id", sessionId);

  return NextResponse.json({
    status,
    sessionId,
    confidence,
    extracted,
    match: match ?? null,
    suggestions: match ? [] : [],
  });
}

async function resolveVariant(supabase: any, extracted: any) {
  // find product
  const { data: products } = await supabase
    .from("products")
    .select("id, brand, line, name")
    .ilike("brand", `%${extracted.brand}%`)
    .ilike("name", `%${extracted.name}%`)
    .limit(5);

  if (!products?.length) return null;

  // find best variant by size/form
  const productId = products[0].id;
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, product_id, size_g, form, intensity, arabica_pct, organic")
    .eq("product_id", productId)
    .limit(10);

  const v = (variants ?? []).find((x: any) =>
    (extracted.size_g ? x.size_g === extracted.size_g : true) &&
    (extracted.form ? x.form === extracted.form : true)
  );

  if (!v) return null;

  return {
    product_id: productId,
    variant_id: v.id,
    brand: products[0].brand,
    line: products[0].line,
    name: products[0].name,
    size_g: v.size_g,
    form: v.form,
    intensity: v.intensity,
    arabica_pct: v.arabica_pct,
    organic: v.organic,
  };
}