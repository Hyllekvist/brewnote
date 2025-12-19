import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/scan";
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // 1️⃣ Hvis Supabase sender en fejl → tilbage til login
  if (error) {
    const dest = `/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent(
      errorDescription || error
    )}`;
    return NextResponse.redirect(new URL(dest, url.origin));
  }

  const cookieStore = cookies();

  // 2️⃣ Server-side Supabase client (cookies = auth session)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  // 3️⃣ Udveksl code → session + sæt cookies
  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const dest = `/login?next=${encodeURIComponent(next)}&err=${encodeURIComponent(
        exchangeError.message
      )}`;
      return NextResponse.redirect(new URL(dest, url.origin));
    }
  }

  // 4️⃣ Redirect brugeren videre (typisk /scan)
  return NextResponse.redirect(new URL(next, url.origin));
}