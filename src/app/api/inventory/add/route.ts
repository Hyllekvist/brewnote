import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { userKey, variantId, qty } = await req.json();

  if (!userKey || !variantId) {
    return NextResponse.json({ error: "Missing userKey/variantId" }, { status: 400 });
  }

  const q = Number.isFinite(Number(qty)) ? Math.max(1, Number(qty)) : 1;

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("inventory")
    .upsert(
      { user_key: userKey, variant_id: variantId, qty: q },
      { onConflict: "user_key,variant_id" }
    )
    .select("user_key,variant_id,qty")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, item: data });
}
