import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    ok: Boolean(url && anon),
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anon),
  });
}
