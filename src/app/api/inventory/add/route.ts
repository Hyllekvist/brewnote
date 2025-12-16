import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json();
  const variantId = body?.variantId as string | undefined;

  if (!variantId) {
    return NextResponse.json({ error: "Missing variantId" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // MVP uden login: vi gemmer bare variant_id + qty
  // (tilføj user_id senere når du vil have login)
  const { data, error } = await supabase
    .from("inventory")
    .insert({
      variant_id: variantId,
      qty: 1,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, row: data });
}
