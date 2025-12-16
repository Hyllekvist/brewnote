import { NextResponse } from "next/server";
import { createClient } from "@supabase/ssr";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) {
    return NextResponse.json(
      { ok: false, error: "Missing env vars" },
      { status: 500 }
    );
  }

  // Server-safe init
  createClient(url, anon, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        /* no-op for health */
      },
    },
  });

  return NextResponse.json({ ok: true, supabase: "server client ok" });
}
