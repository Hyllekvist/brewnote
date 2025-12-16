import { NextResponse } from "next/server";

export const runtime = "edge"; // kan fjernes hvis du vil køre node

type Body = {
  user_key: string;
  product_slug: string;
  product_type: "coffee" | "tea";
  method: string;
  ratio_label?: string;
  dose_g?: number;
  water_g?: number;
  total_seconds: number;
};

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase env vars");
  return { url, anon };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.user_key || !body?.product_slug || !body?.method) {
      return NextResponse.json({ ok: false, body: "Missing fields" }, { status: 400 });
    }

    const { url, anon } = env();

    // ✅ Insert brew log
    const res = await fetch(`${url}/rest/v1/brews`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
        // ✅ RLS header (hvis dine policies bruger den)
        "x-user-key": body.user_key,
      },
      body: JSON.stringify([
        {
          user_key: body.user_key,
          product_slug: body.product_slug,
          product_type: body.product_type,
          method: body.method,
          ratio_label: body.ratio_label ?? null,
          dose_g: body.dose_g ?? null,
          water_g: body.water_g ?? null,
          total_seconds: body.total_seconds,
        },
      ]),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ ok: false, body: text || `HTTP ${res.status}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, body: e?.message || "Server error" }, { status: 500 });
  }
}
