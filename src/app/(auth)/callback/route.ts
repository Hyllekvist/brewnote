import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  // Exchange code -> session (sætter auth cookies)
  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // fallback tilbage til login med fejl
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=1`, url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}