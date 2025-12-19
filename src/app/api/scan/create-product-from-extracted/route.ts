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
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const supabase = supabaseServer();

  const { data: auth, error: aErr } = await supabase.auth.getUser();
  const user = auth?.user;
  if (aErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const extracted = (session.extracted ?? {}) as Extracted;

  const brand = (extracted.brand ?? "").trim();
  const name = (extracted.name ?? "").trim();
  const line = (extracted.line ?? "").trim() || null;

  if (!brand || !name) {
    return NextResponse.json({ error: "Brand + name kræves for at oprette produkt." }, { status: 400 });
  }

  // 1) create product
  const { data: pRow, error: pErr } = await supabase
    .from("products")
    .insert({ brand, line, name })
    .select("id, brand, line, name")
    .single();

  if (pErr || !pRow) return NextResponse.json({ error: pErr?.message ?? "product insert failed" }, { status: 400 });

  // 2) create variant
  const { data: vRow, error: vErr } = await supabase
    .from("product_variants")
    .insert({
      product_id: pRow.id,
      size_g: extracted.size_g ?? null,
      form: extracted.form ?? null,
      intensity: extracted.intensity ?? null,
      arabica_pct: extracted.arabica_pct ?? null,
      organic: extracted.organic ?? null,
    })
    .select("id, size_g, form, intensity, arabica_pct, organic")
    .single();

  if (vErr || !vRow) return NextResponse.json({ error: vErr?.message ?? "variant insert failed" }, { status: 400 });

  // 3) optional barcode
  if (extracted.ean) {
    await supabase.from("product_barcodes").insert({
      ean: extracted.ean,
      variant_id: vRow.id,
    });
  }

  const match = {
    product_id: pRow.id,
    variant_id: vRow.id,
    brand: pRow.brand,
    line: pRow.line,
    name: pRow.name,
    size_g: vRow.size_g,
    form: vRow.form,
    intensity: vRow.intensity,
    arabica_pct: vRow.arabica_pct,
    organic: vRow.organic,
  };

  // 4) update session
  const confidence = 0.92;
  const status = "resolved";

  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      resolved_variant_id: vRow.id,
      resolution_confidence: confidence,
      status,
    })
    .eq("id", sessionId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // 5) learning fingerprint
  const fp = fingerprintFromExtracted(extracted);
  await supabase.from("scan_fingerprints").upsert(
    { fingerprint: fp, variant_id: vRow.id },
    { onConflict: "fingerprint" }
  );

  return NextResponse.json({
    confidence,
    extracted,
    match,
  });
}