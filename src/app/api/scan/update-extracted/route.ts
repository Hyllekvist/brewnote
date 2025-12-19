// src/app/api/scan/update-extracted/route.ts 
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { sessionId, extracted, ocr_text, ocr_confidence } = body;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // ✅ auth
  const { data: auth, error: aErr } = await supabase.auth.getUser();
  const user = auth?.user;
  if (aErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ session + ownership
  const { data: session, error: sErr } = await supabase
    .from("scan_sessions")
    .select("id,user_id")
    .eq("id", sessionId)
    .single();

  if (sErr || !session) {
    return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  }

  // legacy claim
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

  // ✅ update payload (kun felter der findes i body)
  const patch: Record<string, any> = {
    extracted: extracted ?? {},
  };

  if (typeof ocr_text === "string") patch.ocr_text = ocr_text;
  if (typeof ocr_confidence === "number") patch.ocr_confidence = ocr_confidence;

  const { error: upErr } = await supabase.from("scan_sessions").update(patch).eq("id", sessionId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}