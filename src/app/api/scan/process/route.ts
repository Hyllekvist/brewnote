// src/app/api/scan/process/route.ts
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
    (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  return [
    `b:${norm(ex.brand)}`,
    `l:${norm(ex.line)}`,
    `n:${norm(ex.name)}`,
    `s:${ex.size_g ?? ""}`,
    `f:${norm(ex.form)}`,
  ].join("|");
}

async function requireUser(supabase: any) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

export async function POST(req: Request) {
  const { sessionId } = await req.json();

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // ✅ auth
  const user = await requireUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1) hent session
  const { data: session, error: sErr } = await supabase
    .from("scan_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sErr || !session) {
    return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  }

  // ✅ ownership hardening (legacy fix hvis user_id == null)
  if (session.user_id == null) {
    const { error: claimErr } = await supabase
      .from("scan_sessions")
      .update({ user_id: user.id })
      .eq("id", sessionId);

    if (claimErr) {
      return NextResponse.json({ error: claimErr.message }, { status: 400 });
    }

    session.user_id = user.id;
  }

  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2) extracted (ingen mock!)
  const extracted: Extracted =
    session.extracted && Object.keys(session.extracted).length > 0
      ? (session.extracted as Extracted)
      : {};

  // Hvis vi ikke har noget at matche på endnu → needs_user
  if (Object.keys(extracted).length === 0) {
    const status = "needs_user" as const;
    const confidence = 0.2;

    await supabase
      .from("scan_sessions")
      .update({ status, resolution_confidence: confidence })
      .eq("id", sessionId);

    return NextResponse.json({
      status,
      sessionId,
      confidence,
      extracted,
      match: null,
      suggestions: [],
      imagePath: session.image_path,
    });
  }

  // 3) fingerprint lookup (learning)
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

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

      return NextResponse.json({
        status,
        sessionId,
        confidence,
        extracted,
        match,
        suggestions: [],
        imagePath: session.image_path,
      });
    }
  }

  // 4) resolve + suggestions
  const { match, suggestions } = await resolveVariantWithSuggestions(supabase, extracted);

  const status: "resolved" | "needs_user" | "failed" = match ? "resolved" : "needs_user";
  const confidence = match ? 0.9 : suggestions.length ? 0.55 : 0.35;

  // 5) persist session
  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      extracted,
      resolved_variant_id: match?.variant_id ?? null,
      resolution_confidence: confidence,
      status,
    })
    .eq("id", sessionId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({
    status,
    sessionId,
    confidence,
    extracted,
    match: match ?? null,
    suggestions,
    imagePath: session.image_path,
  });
}

async function matchByVariantId(supabase: any, variantId: string): Promise<Match | null> {
  const { data, error } = await supabase
    .from("product_variants")
    .select("id, size_g, form, intensity, arabica_pct, organic, products(id, brand, line, name)")
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
  // A) barcode match
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

  // B) fuzzy product match
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

  // vælg første produkt med varianter
  let bestProduct: any = null;
  let bestVariants: any[] = [];

  for (const cand of products) {
    const { data: vars } = await supabase
      .from("product_variants")
      .select("id, size_g, form, intensity, arabica_pct, organic")
      .eq("product_id", cand.id)
      .limit(25);

    if ((vars?.length ?? 0) > 0) {
      bestProduct = cand;
      bestVariants = vars ?? [];
      break;
    }
  }

  if (!bestProduct) return { match: null, suggestions: [] };

  const p = bestProduct;
  const variants = bestVariants;

  // C) exact variant match på size + form
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