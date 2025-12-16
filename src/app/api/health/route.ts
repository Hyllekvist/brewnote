import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  // simpel ping: tjek at env findes + at client kan init
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ ok: false, error: "Missing env vars" }, { status: 500 });
  }

  // Hvis du ikke har tabeller endnu, så stop her:
  return NextResponse.json({ ok: true, supabase: "configured" });
}
