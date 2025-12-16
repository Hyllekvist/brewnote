import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const user_key = String(body.user_key || "");
    const product_slug = String(body.product_slug || "");
    const product_type = String(body.product_type || "");
    const method = body.method ? String(body.method) : null;
    const seconds = body.seconds != null ? Number(body.seconds) : null;

    if (!user_key || !product_slug || !product_type) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) {
      return NextResponse.json({ ok: false, error: "Missing env" }, { status: 500 });
    }

    const res = await fetch(`${url}/rest/v1/brew_log`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
        "x-user-key": user_key, // ✅ RLS matcher policies
      },
      body: JSON.stringify([
        { user_key, product_slug, product_type, method, seconds },
      ]),
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) return NextResponse.json({ ok: false, body: text }, { status: res.status });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown" }, { status: 500 });
  }
}
