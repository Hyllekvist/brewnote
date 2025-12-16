import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const user_key = searchParams.get("user_key");
    const product_slug = searchParams.get("product_slug");

    if (!user_key || !product_slug) {
      return NextResponse.json(
        { ok: false, body: "Missing user_key or product_slug" },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) {
      return NextResponse.json({ ok: false, body: "Missing Supabase env vars" }, { status: 500 });
    }

    const sb = await fetch(
      `${url}/rest/v1/brew_sessions?select=created_at,method,ratio_label,dose_g,water_g,total_seconds` +
        `&user_key=eq.${encodeURIComponent(user_key)}` +
        `&product_slug=eq.${encodeURIComponent(product_slug)}` +
        `&order=created_at.desc&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          "Content-Type": "application/json",
          "x-user-key": user_key, // ✅ RLS
        },
        cache: "no-store",
      }
    );

    const text = await sb.text();
    if (!sb.ok) {
      return NextResponse.json({ ok: false, body: text || `HTTP ${sb.status}` }, { status: sb.status });
    }

    const rows = text ? JSON.parse(text) : [];
    const latest = Array.isArray(rows) && rows.length ? rows[0] : null;

    return NextResponse.json({ ok: true, latest });
  } catch (e: any) {
    return NextResponse.json({ ok: false, body: e?.message || "Unknown error" }, { status: 500 });
  }
}