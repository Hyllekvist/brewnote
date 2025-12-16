import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { user_key, product_slug } = await req.json();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) {
    return NextResponse.json({ ok: false, error: "Missing env" }, { status: 500 });
  }

  const res = await fetch(`${url}/rest/v1/inventory`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ user_key, product_slug }]),
  });

  const text = await res.text();
  return NextResponse.json({ ok: res.ok, status: res.status, body: text }, { status: res.ok ? 200 : 400 });
}