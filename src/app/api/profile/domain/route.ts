import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Domain = "coffee" | "tea";

function asNum(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const domain = (url.searchParams.get("domain") || "coffee") as Domain;

  if (domain !== "coffee" && domain !== "tea") {
    return NextResponse.json({ ok: false, error: "Invalid domain" }, { status: 400 });
  }

  const user_id = auth.user.id;

  // 1) profile (mu/sigma/beta)
  const { data: prof, error: profErr } = await supabase
    .from("user_domain_profiles")
    .select("mu, sigma, beta, updated_at")
    .eq("user_id", user_id)
    .eq("domain", domain)
    .maybeSingle();

  if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });

  // 2) confidence = count ratings for this user+domain  ✅ (user_id, ikke user_key)
  const { count: ratingsCount, error: countErr } = await supabase
    .from("taste_ratings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user_id)
    .eq("domain", domain);

  if (countErr) return NextResponse.json({ ok: false, error: countErr.message }, { status: 400 });

  const confidence_count = Number(ratingsCount ?? 0);

  // 3) sensitivity from sigma (lav sigma = høj følsomhed)
  const sigma = (prof?.sigma ?? null) as any;

  const acidity_sigma = sigma ? Math.max(0.08, asNum(sigma.a, 0.35)) : 0.35;
  const bitterness_sigma = sigma ? Math.max(0.08, asNum(sigma.b, 0.35)) : 0.35;

  let most_sensitive: "acidity" | "bitterness" | null = null;
  if (confidence_count >= 1) {
    if (Math.abs(acidity_sigma - bitterness_sigma) < 1e-9) most_sensitive = null;
    else most_sensitive = acidity_sigma < bitterness_sigma ? "acidity" : "bitterness";
  }

  return NextResponse.json({
    ok: true,
    domain,
    mu: prof?.mu ?? null,
    sigma: prof?.sigma ?? null,
    confidence_count,
    sensitivity: { acidity_sigma, bitterness_sigma, most_sensitive },
  });
}