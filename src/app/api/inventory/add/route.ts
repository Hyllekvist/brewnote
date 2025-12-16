import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { variantId, qty } = await req.json();

    if (!variantId) {
      return NextResponse.json({ error: "Missing variantId" }, { status: 400 });
    }

    const supabase = supabaseServer();

    // ✅ hent user fra auth (cookies)
    const { data: u, error: uErr } = await supabase.auth.getUser();
    const user = u?.user;

    if (uErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const insertPayload: any = {
      user_key: user.id,
      variant_id: variantId,
    };

    // qty er optional (kun hvis din tabel har den)
    if (qty != null) insertPayload.qty = Number(qty);

    const { data, error } = await supabase
      .from("inventory")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
