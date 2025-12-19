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

  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  if (!variantId) return NextResponse.json({ error: "Missing variantId" }, { status: 400 });

  const supabase = supabaseServer();

  // auth
  const { data: auth, error: aErr } = await supabase.auth.getUser();
  const user = auth?.user;
  if (aErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // load session (ownership)
  const { data: session, error: sErr } = await supabase
    .from("scan_sessions")
    .select("id,user_id,extracted,image_path")
    .eq("id", sessionId)
    .single();

  if (sErr || !session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });

  // legacy claim (hvis gamle sessions har user_id null)
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
  if (!extracted || Object.keys(extracted).length === 0) {
    return NextResponse.json(
      { error: "No extracted data on session (nothing to learn from yet)." },
      { status: 400 }
    );
  }

  // sanity: variant must exist
  const { data: vRow, error: vErr } = await supabase
    .from("product_variants")
    .select("id, product_id")
    .eq("id", variantId)
    .single();

  if (vErr || !vRow) return NextResponse.json({ error: "Unknown variantId" }, { status: 404 });

  // update session -> resolved
  const confidence = 0.95;
  const status = "resolved";

  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      resolved_variant_id: variantId,
      resolution_confidence: confidence,
      status,
    })
    .eq("id", sessionId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // learning: fingerprint -> variant
  const fp = fingerprintFromExtracted(extracted);
  await supabase.from("scan_fingerprints").upsert(
    { fingerprint: fp, variant_id: variantId },
    { onConflict: "fingerprint" }
  );

  return NextResponse.json({
    ok: true,
    sessionId,
    variantId,
    confidence,
  });
}