import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const variantId = body?.variantId as string | undefined;
    const productId = body?.productId as string | undefined;
    const sessionId = body?.sessionId as string | undefined;

    const bitterness = Number(body?.bitterness);
    const bodyScore = Number(body?.body);
    const clarity = Number(body?.clarity);

    const asExpected =
      body?.as_expected === undefined ? null : Boolean(body?.as_expected);

    const notes =
      typeof body?.notes === "string" ? body.notes.slice(0, 800) : null;

    if (!variantId) {
      return NextResponse.json({ error: "Missing variantId" }, { status: 400 });
    }

    const inRange = (n: number) => Number.isFinite(n) && n >= 1 && n <= 10;
    if (!inRange(bitterness) || !inRange(bodyScore) || !inRange(clarity)) {
      return NextResponse.json(
        { error: "Ratings must be 1..10" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data: u, error: uErr } = await supabase.auth.getUser();
    const user = u?.user;

    if (uErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("taste_ratings")
      .insert({
        user_key: user.id,
        variant_id: variantId,
        product_id: productId ?? null,
        session_id: sessionId ?? null,
        bitterness,
        body: bodyScore,
        clarity,
        as_expected: asExpected,
        notes,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Bad request" },
      { status: 400 }
    );
  }
}