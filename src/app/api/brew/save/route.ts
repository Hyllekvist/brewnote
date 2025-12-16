import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) {
      return NextResponse.json({ ok: false, body: "Missing Supabase env vars" }, { status: 500 });
    }

    // forventet payload fra client
    const {
      user_key,
      product_slug,
      method,
      ratio_label,
      dose_g,
      water_g,
      total_seconds,
    } = body || {};

    if (!user_key || !product_slug) {
      return NextResponse.json({ ok: false, body: "Missing user_key or product_slug" }, { status: 400 });
    }

    const res = await fetch(`${url}/rest/v1/brew_sessions`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
        "x-user-key": user_key, // ✅ RLS
      },
      body: JSON.stringify([
        {
          user_key,
          product_slug,
          method: method ?? null,
          ratio_label: ratio_label ?? null,
          dose_g: typeof dose_g === "number" ? dose_g : null,
          water_g: typeof water_g === "number" ? water_g : null,
          total_seconds: typeof total_seconds === "number" ? total_seconds : null,
        },
      ]),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ ok: false, body: text || `HTTP ${res.status}` }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, body: e?.message || "Unknown error" }, { status: 500 });
  }
}
