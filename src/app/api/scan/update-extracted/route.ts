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

export async function POST(req: Request) {
  const { sessionId, extracted } = (await req.json()) as {
    sessionId?: string;
    extracted?: Extracted;
  };

  if (!sessionId || !extracted) {
    return NextResponse.json(
      { error: "Missing sessionId/extracted" },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();

  // opdater session med brugerens rettelser + reset status
  const { error: upErr } = await supabase
    .from("scan_sessions")
    .update({
      extracted,
      status: "needs_user",
      resolved_variant_id: null,
      resolution_confidence: null,
    })
    .eq("id", sessionId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // kør resolve igen ved at kalde samme logik som process ville gøre:
  // (MVP: vi genbruger /api/scan/process og lader den læse session.extracted hvis du opdaterer process)
  return NextResponse.json({ ok: true });
}
