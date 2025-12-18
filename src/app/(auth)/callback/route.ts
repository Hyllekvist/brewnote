import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  // Hvis ingen code -> send brugeren til login
  if (!code) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Exchange code for session (server-side)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.session) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&err=callback`, url.origin));
  }

  // VIGTIGT:
  // Uden auth-helpers får du ikke automatisk sat session cookies her.
  // Så vi sender brugeren videre og lader client hente session efter redirect.
  return NextResponse.redirect(new URL(next, url.origin));
}