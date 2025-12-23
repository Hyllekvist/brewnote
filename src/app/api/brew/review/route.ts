import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Domain = "coffee" | "tea";
type Quick = "sour" | "balanced" | "bitter" | null;

type Body = {
  variant_id: string;
  domain: Domain;
  stars: number;
  quick?: Quick;
  note?: string;

  // optional metadata
  product_slug?: string;
  method?: string;
  seconds?: number;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.variant_id) return NextResponse.json({ error: "Missing variant_id" }, { status: 400 });
  if (body.domain !== "coffee" && body.domain !== "tea") {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const stars = Number(body.stars);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "Stars must be 1..5" }, { status: 400 });
  }

  const quick = (body.quick ?? null) as Quick;
  const note = (body.note ?? "").trim() || null;

  const { error } = await supabase.from("brew_reviews").insert({
    user_id: auth.user.id,
    variant_id: body.variant_id,
    domain: body.domain,
    stars,
    quick,
    note,
    product_slug: body.product_slug ?? null,
    method: body.method ?? null,
    seconds: Number.isFinite(Number(body.seconds)) ? Number(body.seconds) : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}