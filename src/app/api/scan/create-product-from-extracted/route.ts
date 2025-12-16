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
};

function norm(s?: string) {
  return (s ?? "").trim();
}

function fingerprintFromExtracted(ex: Extracted) {
  const n = (s?: string) =>
    (s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  return [
    `b:${n(ex.brand)}`,
    `l:${n(ex.line)}`,
    `n:${n(ex.name)}`,
    `s:${ex.size_g ?? ""}`,
    `f:${n(ex.form)}`,
  ].join("|");
}

export async function POST(req: Request) {
  const { sessionId } = await req.json();

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // 1) hent session + extracted
  const { data: sess, error: sErr } = await supabase
    .from("scan_sessions")
    .select("id, extracted")
    .eq("id", sessionId)
    .single();

  if (sErr || !sess) {
    return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  }

  const extracted = (sess.extracted ?? {}) as Extracted;

  const brand = norm(extracted.brand);
  const name = norm(extracted.name);
  const line = norm(extracted.line) || null;

  if (!brand || !name) {
    return NextResponse.json(
      { error: "Extracted must include at least brand + name" },
      { status: 400 }
    );
  }

  // 2) upsert product (kræver unique index på (brand,line,name) som du har lavet)
  const { data: product, error: pErr } = await supabase
    .from("products")
    .upsert(
      { brand, line, name },
      { onConflict: "brand,line,name" }
    )
    .select("id, brand, line, name")
    .single();

  if (pErr || !product) {
    return NextResponse.json({ error: pErr?.message ?? "product upsert failed" }, { status: 400 });
  }

  // 3) find eller opret variant (match på product_id + size_g + form)
  const size_g = extracted.size_g ?? null;
  const form = extracted.form ?? null;

  let variantId: string | null = null;

  const { data: existing } = await supabase
    .from("product_variants")
    .select("id, size_g, form")
    .eq("product_id", product.id)
    .eq("size_g", size_g)
    .eq("form", form)
    .limit(1);

  if (existing?.[0]?.id) {
    variantId = existing[0].id;
  } else {
    const { data: vIns, error: vErr } = await supabase
      .from("product_variants")
      .insert({
        product_id: product.id,
        size_g,
        form,
        intensity: extracted.intensity ?? null,
        arabica_pct: extracted.arabica_pct ?? null,
        organic: extracted.organic ?? null,
      })
      .select("id, size_g, form, intensity, arabica_pct, organic")
      .single();

    if (vErr || !vIns) {
      return NextResponse.json({ error: vErr?.message ?? "variant insert failed" }, { status: 400 });
    }

    variantId = vIns.id;
  }

  if (!variantId) {
    return NextResponse.json({ error: "Could not create/find variant" }, { status: 400 });
  }

  // 4) læring: fingerprint -> variant
  const fp = fingerprintFromExtracted(extracted);
  await supabase
    .from("scan_fingerprints")
    .upsert({ fingerprint: fp, variant_id: variantId }, { onConflict: "fingerprint" });

  // 5) opdater scan session til resolved
  const confidence = 0.92;
  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      resolved_variant_id: variantId,
      status: "resolved",
      resolution_confidence: confidence,
    })
    .eq("id", sessionId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // 6) return match (til UI)
  // hent variant + product for at returnere samme shape som resten
  const { data: vRow } = await supabase
    .from("product_variants")
    .select("id, size_g, form, intensity, arabica_pct, organic, products(id, brand, line, name)")
    .eq("id", variantId)
    .single();

  const p = Array.isArray((vRow as any)?.products)
    ? (vRow as any).products[0]
    : (vRow as any)?.products;

  return NextResponse.json({
    status: "resolved",
    sessionId,
    confidence,
    match: {
      product_id: p?.id ?? product.id,
      variant_id: vRow?.id ?? variantId,
      brand: p?.brand ?? product.brand,
      line: p?.line ?? product.line,
      name: p?.name ?? product.name,
      size_g: vRow?.size_g ?? size_g,
      form: vRow?.form ?? form,
      intensity: vRow?.intensity ?? null,
      arabica_pct: vRow?.arabica_pct ?? null,
      organic: vRow?.organic ?? null,
    },
  });
}
