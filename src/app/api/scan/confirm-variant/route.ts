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
    (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return [
    `b:${norm(ex.brand)}`,
    `l:${norm(ex.line)}`,
    `n:${norm(ex.name)}`,
    `s:${ex.size_g ?? ""}`,
    `f:${norm(ex.form)}`,
  ].join("|");
}

export async function POST(req: Request) {
  const { sessionId, variantId } = await req.json();

  if (!sessionId || !variantId) {
    return NextResponse.json({ error: "Missing sessionId/variantId" }, { status: 400 });
  }

  const supabase = supabaseServer();

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

  const extracted = (session.extracted ?? {}) as Extracted;
  const fp = fingerprintFromExtracted(extracted);

  if (!fp || fp.includes("b:|") || fp.includes("n:|")) {
    return NextResponse.json(
      { error: "Kan ikke lære: mangler brand/name i extracted." },
      { status: 400 }
    );
  }

  // verify variant exists
  const { data: v, error: vErr } = await supabase
    .from("product_variants")
    .select("id")
    .eq("id", variantId)
    .single();

  if (vErr || !v) return NextResponse.json({ error: "Unknown variant" }, { status: 404 });

  // ✅ LÆRING (kun her)
  const { error: fpErr } = await supabase
    .from("scan_fingerprints")
    .upsert(
      { fingerprint: fp, variant_id: variantId, confirmed_by: user.id, confirmed_at: new Date().toISOString() },
      { onConflict: "fingerprint" }
    );

  if (fpErr) return NextResponse.json({ error: fpErr.message }, { status: 400 });

  // mark session resolved
  const confidence = 0.97;
  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      resolved_variant_id: variantId,
      resolution_confidence: confidence,
      status: "resolved",
    })
    .eq("id", sessionId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, confidence });
}