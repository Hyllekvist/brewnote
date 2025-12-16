import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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

export async function POST(req: Request) {
  const { sessionId, variantId } = await req.json();

  if (!sessionId || !variantId) {
    return NextResponse.json(
      { error: "Missing sessionId/variantId" },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();

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

  const p =
    Array.isArray(v.products) ? v.products[0] : v.products;

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
