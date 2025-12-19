// src/app/api/scan/confirm-variant/route.ts
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

function norm(s?: string | null) {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function fingerprintFromParts(p: {
  brand?: string | null;
  line?: string | null;
  name?: string | null;
  size_g?: number | null;
  form?: string | null;
}) {
  const brand = norm(p.brand);
  const name = norm(p.name);
  const line = norm(p.line);
  const size = p.size_g ?? "";
  const form = norm(p.form);

  if (!brand || !name) return ""; // kan ikke lære uden brand+name

  return [`b:${brand}`, `l:${line}`, `n:${name}`, `s:${size}`, `f:${form}`].join("|");
}

export async function POST(req: Request) {
  const { sessionId, variantId } = await req.json();

  if (!sessionId || !variantId) {
    return NextResponse.json({ error: "Missing sessionId/variantId" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // auth
  const { data: auth, error: aErr } = await supabase.auth.getUser();
  const user = auth?.user;
  if (aErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // session + ownership
  const { data: session, error: sErr } = await supabase
    .from("scan_sessions")
    .select("id,user_id,extracted")
    .eq("id", sessionId)
    .single();

  if (sErr || !session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });

  // legacy claim
  if (session.user_id == null) {
    const { error: claimErr } = await supabase
      .from("scan_sessions")
      .update({ user_id: user.id })
      .eq("id", sessionId);

    if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 400 });
    session.user_id = user.id;
  }

  if (session.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // fetch variant + product (så vi kan returnere match + lave fallback-fingerprint)
  const { data: vRow, error: vErr } = await supabase
    .from("product_variants")
    .select("id, product_id, size_g, form, intensity, arabica_pct, organic, products(id, brand, line, name)")
    .eq("id", variantId)
    .single();

  if (vErr || !vRow) return NextResponse.json({ error: "Unknown variant" }, { status: 404 });

  const p = Array.isArray((vRow as any).products) ? (vRow as any).products[0] : (vRow as any).products;
  if (!p) return NextResponse.json({ error: "Variant missing product relation" }, { status: 400 });

  const match: Match = {
    product_id: p.id,
    variant_id: vRow.id,
    brand: p.brand,
    line: p.line ?? null,
    name: p.name,
    size_g: vRow.size_g ?? null,
    form: vRow.form ?? null,
    intensity: vRow.intensity ?? null,
    arabica_pct: vRow.arabica_pct ?? null,
    organic: vRow.organic ?? null,
  };

  // fingerprint: først fra session.extracted, ellers fra variant+product
  const extracted = (session.extracted ?? {}) as Extracted;

  const fpFromExtracted = fingerprintFromParts({
    brand: extracted.brand,
    line: extracted.line ?? null,
    name: extracted.name,
    size_g: extracted.size_g ?? null,
    form: extracted.form ?? null,
  });

  const fpFallback = fingerprintFromParts({
    brand: match.brand,
    line: match.line ?? null,
    name: match.name,
    size_g: match.size_g ?? null,
    form: match.form ?? null,
  });

  const fp = fpFromExtracted || fpFallback;

  // ✅ læring (hvis vi har et brugbart fingerprint)
  if (fp) {
    const { error: fpErr } = await supabase
      .from("scan_fingerprints")
      .upsert({ fingerprint: fp, variant_id: variantId }, { onConflict: "fingerprint" });

    if (fpErr) return NextResponse.json({ error: fpErr.message }, { status: 400 });
  }

  // mark session resolved
  const confidence = fp ? 0.97 : 0.9;

  // (valgfrit men smart): hvis extracted var tom/ufuldstændig, så gem “canonical” extracted
  const canonicalExtracted: Extracted = {
    ...extracted,
    brand: extracted.brand ?? match.brand,
    line: extracted.line ?? (match.line ?? undefined),
    name: extracted.name ?? match.name,
    size_g: extracted.size_g ?? (match.size_g ?? undefined),
    form: extracted.form ?? ((match.form as any) ?? undefined),
  };

  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      status: "resolved",
      resolved_variant_id: variantId,
      resolution_confidence: confidence,
      extracted: canonicalExtracted,
    })
    .eq("id", sessionId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, confidence, match });
}