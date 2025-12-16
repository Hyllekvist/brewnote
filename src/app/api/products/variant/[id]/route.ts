import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function recommendBrew(input: {
  form?: string | null;
  intensity?: number | null;
}) {
  const form = input.form ?? "beans";
  const intensity = input.intensity ?? null;

  // MVP heuristik (kan erstattes senere af “brew_presets”)
  if (form === "ground") {
    return {
      method: "Filter / Pour over",
      grind: "Medium",
      ratio: "1:16",
      temp_c: 94,
      notes: "Kværn kan ikke antages, så vi foreslår en safe filter-profil.",
    };
  }

  // beans
  if (intensity != null && intensity >= 8) {
    return {
      method: "Espresso",
      grind: "Fine",
      ratio: "1:2",
      temp_c: 93,
      notes: "Høj intensitet → ofte robust til espresso.",
    };
  }

  return {
    method: "V60 / Pour over",
    grind: "Medium-fine",
    ratio: "1:16",
    temp_c: 93,
    notes: "Standard anbefaling til beans i mellem intensitet.",
  };
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const variantId = ctx.params.id;
  if (!variantId) {
    return NextResponse.json({ error: "Missing variant id" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // 1) variant + product (undgår relation-navne issues ved at holde det simpelt)
  const { data: v, error: vErr } = await supabase
    .from("product_variants")
    .select("id, product_id, size_g, form, intensity, arabica_pct, organic")
    .eq("id", variantId)
    .single();

  if (vErr || !v) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const { data: p, error: pErr } = await supabase
    .from("products")
    .select("id, brand, line, name")
    .eq("id", v.product_id)
    .single();

  if (pErr || !p) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // 2) origin (MVP: forventer 0 eller 1 row pr product)
  const { data: originRow } = await supabase
    .from("product_origin")
    .select("*")
    .eq("product_id", p.id)
    .maybeSingle();

  // 3) dna (MVP: forventer 0 eller 1 row pr product)
  const { data: dnaRow } = await supabase
    .from("product_dna")
    .select("*")
    .eq("product_id", p.id)
    .maybeSingle();

  const brew = recommendBrew({ form: v.form, intensity: v.intensity });

  return NextResponse.json({
    variant: {
      id: v.id,
      product_id: v.product_id,
      size_g: v.size_g,
      form: v.form,
      intensity: v.intensity,
      arabica_pct: v.arabica_pct,
      organic: v.organic,
    },
    product: p,
    origin: originRow ?? null,
    dna: dnaRow ?? null,
    brew,
  });
}
