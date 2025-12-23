import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Domain = "coffee" | "tea";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = (searchParams.get("domain") || "coffee") as Domain;
    const user_key = searchParams.get("user_key");

    if (!user_key) {
      return NextResponse.json({ ok: false, error: "Missing user_key" }, { status: 400 });
    }
    if (domain !== "coffee" && domain !== "tea") {
      return NextResponse.json({ ok: false, error: "Invalid domain" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) {
      return NextResponse.json({ ok: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    // 1) profile (mu + sigma)
    const profRes = await fetch(
      `${url}/rest/v1/user_domain_profiles?select=mu,sigma` +
        `&user_key=eq.${encodeURIComponent(user_key)}` +
        `&domain=eq.${encodeURIComponent(domain)}` +
        `&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          "Content-Type": "application/json",
          "x-user-key": user_key,
        },
        cache: "no-store",
      }
    );

    const profText = await profRes.text();
    if (!profRes.ok) {
      return NextResponse.json({ ok: false, error: profText || `HTTP ${profRes.status}` }, { status: profRes.status });
    }

    const profRows = profText ? JSON.parse(profText) : [];
    const prof = Array.isArray(profRows) && profRows.length ? profRows[0] : null;

    // 2) count ratings (confidence)
    // Hvis din tabel hedder noget andet end taste_ratings, så ret den her.
    const countRes = await fetch(
      `${url}/rest/v1/taste_ratings?select=count` +
        `&user_key=eq.${encodeURIComponent(user_key)}` +
        `&domain=eq.${encodeURIComponent(domain)}`,
      {
        method: "GET",
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          "Content-Type": "application/json",
          "x-user-key": user_key,
          Prefer: "count=exact",
        },
        cache: "no-store",
      }
    );

    // Supabase count ligger i Content-Range header, men vi kan også bare læse headeren.
    let count = 0;
    if (countRes.ok) {
      const cr = countRes.headers.get("content-range"); // fx "0-9/12"
      const total = cr?.split("/")?.[1];
      count = total ? Number(total) || 0 : 0;
      // dræn body
      await countRes.text().catch(() => "");
    }

    return NextResponse.json({
      ok: true,
      mu: prof?.mu ?? null,
      sigma: prof?.sigma ?? null,
      count,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}