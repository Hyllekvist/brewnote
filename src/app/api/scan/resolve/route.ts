import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { sessionId, variantId } = await req.json();

  if (!sessionId || !variantId) {
    return NextResponse.json(
      { error: "Missing sessionId/variantId" },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();

  // hent variant + product (så vi kan returnere match til UI)
  const { data: v, error: vErr } = await supabase
    .from("product_variants")
    .select(
      "id, size_g, form, intensity, arabica_pct, organic, products(id, brand, line, name)"
    )
    .eq("id", variantId)
    .single();

  if (vErr || !v?.products) {
    return NextResponse.json({ error: "Unknown variant" }, { status: 404 });
  }

  const match = {
    product_id: v.products.id,
    variant_id: v.id,
    brand: v.products.brand,
    line: v.products.line,
    name: v.products.name,
    size_g: v.size_g,
    form: v.form,
    intensity: v.intensity,
    arabica_pct: v.arabica_pct,
    organic: v.organic,
  };

  // opdater scan_session som resolved
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

  return NextResponse.json({
    status: "resolved",
    sessionId,
    confidence: 0.85,
    match,
  });
}