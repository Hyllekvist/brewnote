import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const variantId = body?.variantId;
    const addQty = Number(body?.qty ?? 1);

    if (!variantId) {
      return NextResponse.json({ error: "Missing variantId" }, { status: 400 });
    }

    const qtyToAdd = Number.isFinite(addQty) && addQty > 0 ? addQty : 1;

    const supabase = supabaseServer();

    const { data: u, error: uErr } = await supabase.auth.getUser();
    const user = u?.user;

    if (uErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1) find existing row
    const { data: existing, error: selErr } = await supabase
      .from("inventory")
      .select("id, qty")
      .eq("user_key", user.id)
      .eq("variant_id", variantId)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 400 });
    }

    // 2) update qty if exists, else insert
    if (existing?.id) {
      const newQty = (existing.qty ?? 0) + qtyToAdd;

      const { data: row, error: upErr } = await supabase
        .from("inventory")
        .update({ qty: newQty })
        .eq("id", existing.id)
        .select()
        .single();

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      return NextResponse.json({ ok: true, row });
    }

    const { data: row, error: insErr } = await supabase
      .from("inventory")
      .insert({
        user_key: user.id,
        variant_id: variantId,
        qty: qtyToAdd,
      })
      .select()
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
