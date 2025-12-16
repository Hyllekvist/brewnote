import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const variantId = body?.variantId;
    const qty = body?.qty ?? 1;

    if (!variantId) {
      return NextResponse.json(
        { error: "Missing variantId" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // 🔐 Auth (cookie-based)
    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user;

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 🧠 Indsæt i inventory
    const { data: row, error } = await supabase
      .from("inventory")
      .insert({
        user_key: user.id,        // NOT NULL
        variant_id: variantId,    // NOT NULL + FK
        qty: Number(qty) || 1,    // default = 1
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Bad request" },
      { status: 400 }
    );
  }
}
