import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Domain = "coffee" | "tea";

function asDomain(x: string | null): Domain | null {
  if (x === "coffee" || x === "tea") return x;
  return null;
}

function num(v: any, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const domain = asDomain(url.searchParams.get("domain")) ?? "coffee";

  // 1) profil (mu/sigma)
  const { data: prof, error: profErr } = await supabase
    .from("user_domain_profiles")
    .select("mu, sigma, beta, updated_at")
    .eq("user_id", auth.user.id)
    .eq("domain", domain)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });
  }

  // 2) ✅ ratings count — count på user_id (IKKE user_key)
  const { count, error: cntErr } = await supabase
    .from("taste_ratings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .eq("domain", domain);

  if (cntErr) {
    return NextResponse.json({ ok: false, error: cntErr.message }, { status: 400 });
  }

  const confidence_count = count ?? 0;

  // 3) sensitivity fra sigma (lav sigma = mere følsom)
  const sigma = prof?.sigma ?? null;
  const acidity_sigma = num(sigma?.a, 0.35);
  const bitterness_sigma = num(sigma?.b, 0.35);

  let most_sensitive: "acidity" | "bitterness" | null = null;
  if (confidence_count >= 1 && sigma) {
    most_sensitive = acidity_sigma <= bitterness_sigma ? "acidity" : "bitterness";
  }

  return NextResponse.json({
    ok: true,
    domain,
    mu: prof?.mu ?? null,
    sigma,
    confidence_count,
    sensitivity: {
      acidity_sigma,
      bitterness_sigma,
      most_sensitive,
    },
  });
}