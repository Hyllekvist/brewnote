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
  ean?: string;
};

type Match = {
  product_id: string;
  variant_id: string;
  brand: string;
  line?: string | null;
  name: string;
  size_g?: number | null;
  form?: string | null;
  intensity?: number | null;
  arabica_pct?: number | null;
  organic?: boolean | null;
};

type Suggestion = {
  variant_id: string;
  label: string;
  confidence: number;
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
  const extracted: Extracted = {
    brand: "Lavazza",
    line: "Tierra!",
    name: "Bio-Organic",
    size_g: 500,
    form: "beans",
    intensity: 6,
    arabica_pct: 100,
    organic: true,
  };

  // 2.5) LÆRING LOOKUP (fingerprint -> variant)
  const fp = fingerprintFromExtracted(extracted);

  const { data: fpRow } = await supabase
    .from("scan_fingerprints")
    .select("variant_id")
    .eq("fingerprint", fp)
    .maybeSingle();

  if (fpRow?.variant_id) {
    const match = await matchByVariantId(supabase, fpRow.variant_id);

    if (match) {
      const status: "resolved" = "resolved";
      const confidence = 0.99;

      const { error: upErr } = await supabase
        .from("scan_sessions")
        .update({
          extracted,
          resolved_variant_id: match.variant_id,
          resolution_confidence: confidence,
          status,
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
        match,
        suggestions: [],
      });
    }
  }

  // 3) resolve + suggestions
  const { match, suggestions } = await resolveVariantWithSuggestions(
    supabase,
    extracted
  );

  const status: "resolved" | "needs_user" | "failed" = match
    ? "resolved"
    : "needs_user";

  const confidence = match ? 0.9 : suggestions.length ? 0.55 : 0.35;

  // 4) persist session
  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      extracted,
      resolved_variant_id: match?.variant_id ?? null,
      resolution_confidence: confidence,
      status,
    })
    .eq("id", sessionId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // 5) LÆRING UPSERT (kun når resolved)
  if (match?.variant_id) {
    await supabase.from("scan_fingerprints").upsert(
      {
        fingerprint: fp,
        variant_id: match.variant_id,
      },
      { onConflict: "fingerprint" }
    );
  }

  return NextResponse.json({
    status,
    sessionId,
    confidence,
    extracted,
    match: match ?? null,
    suggestions,
  });
}

async function matchByVariantId(supabase: any, variantId: string): Promise<Match | null> {
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, size_g, form, intensity, arabica_pct, organic, products(id, brand, line, name)"
    )
    .eq("id", variantId)
    .single();

  if (error || !data) return null;

  const p = Array.isArray((data as any).products)
    ? (data as any).products[0]
    : (data as any).products;

  if (!p) return null;

  return {
    product_id: p.id,
    variant_id: data.id,
    brand: p.brand,
    line: p.line,
    name: p.name,
    size_g: data.size_g,
    form: data.form,
    intensity: data.intensity,
    arabica_pct: data.arabica_pct,
    organic: data.organic,
  };
}

async function resolveVariantWithSuggestions(
  supabase: any,
  ex: Extracted
): Promise<{ match: Match | null; suggestions: Suggestion[] }> {
  // A) barcode match (senere)
  if (ex.ean) {
    const { data: rows } = await supabase
      .from("product_barcodes")
      .select(
        "variant_id, product_variants(id, size_g, form, intensity, arabica_pct, organic, products(id, brand, line, name))"
      )
      .eq("ean", ex.ean)
      .limit(1);

    const hit = rows?.[0];
    if (hit?.product_variants?.products) {
      const p = hit.product_variants.products;
      const v = hit.product_variants;

      return {
        match: {
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
        },
        suggestions: [],
      };
    }
  }

  // B) fuzzy product match (brand + name + line)
  const brandQ = ex.brand ? `%${ex.brand}%` : "%";
  const nameQ = ex.name ? `%${ex.name}%` : "%";
  const lineQ = ex.line ? `%${ex.line}%` : "%";

  const { data: products } = await supabase
    .from("products")
    .select("id, brand, line, name")
    .ilike("brand", brandQ)
    .ilike("name", nameQ)
    .ilike("line", lineQ)
    .limit(10);

  if (!products?.length) return { match: null, suggestions: [] };

  // Vælg produktet der faktisk har varianter (undgår duplicates)
  let bestProduct: any = null;
  let bestVariants: any[] = [];

  for (const cand of products) {
    const { data: vars } = await supabase
      .from("product_variants")
      .select("id, size_g, form, intensity, arabica_pct, organic")
      .eq("product_id", cand.id)
      .limit(25);

    if ((vars?.length ?? 0) > (bestVariants.length ?? 0)) {
      bestProduct = cand;
      bestVariants = vars ?? [];
    }

    if ((vars?.length ?? 0) > 0) break;
  }

  if (!bestProduct) return { match: null, suggestions: [] };

  const p = bestProduct;
  const variants = bestVariants;

  if (!variants.length) {
    return {
      match: null,
      suggestions: [
        {
          variant_id: "",
          label: `${p.brand} ${p.line ? p.line + " " : ""}${p.name} (ingen varianter i DB)`,
          confidence: 0.3,
        },
      ],
    };
  }

  // D) exact variant match på size + form
  const exact = variants.find((v: any) => {
    const sizeOk = ex.size_g ? v.size_g === ex.size_g : true;
    const formOk = ex.form ? v.form === ex.form : true;
    return sizeOk && formOk;
  });

  if (!exact) {
    const suggestions: Suggestion[] = variants.slice(0, 5).map((v: any) => ({
      variant_id: v.id,
      label: `${p.brand} ${p.line ? p.line + " " : ""}${p.name} — ${v.size_g ?? "?"}g ${v.form ?? ""}`.trim(),
      confidence: 0.55,
    }));
    return { match: null, suggestions };
  }

  return {
    match: {
      product_id: p.id,
      variant_id: exact.id,
      brand: p.brand,
      line: p.line,
      name: p.name,
      size_g: exact.size_g,
      form: exact.form,
      intensity: exact.intensity,
      arabica_pct: exact.arabica_pct,
      organic: exact.organic,
    },
    suggestions: [],
  };
}
