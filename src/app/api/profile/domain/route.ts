import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Domain = "coffee" | "tea";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function asNum(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function readSigma(sigma: any, key: string, fallback = 0.35) {
  // lav sigma = mere følsom; vi floorer for stabilitet
  return Math.max(0.08, asNum(sigma?.[key], fallback));
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const { data: prof, error: profErr } = await supabase
    .from("user_domain_profiles")
    .select("mu, sigma, ratings_count")
    .eq("user_id", user_id)
    .eq("domain", domain)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });
  }

  const mu = prof?.mu ?? null;
  const sigma = prof?.sigma ?? null;

  const confidence_count = Number(prof?.ratings_count ?? 0);

  const acidity_sigma = readSigma(sigma, "a", 0.35);
  const bitterness_sigma = readSigma(sigma, "b", 0.35);

  let most_sensitive: "acidity" | "bitterness" | null = null;
  if (confidence_count >= 3) {
    most_sensitive = acidity_sigma <= bitterness_sigma ? "acidity" : "bitterness";
  }

  return NextResponse.json({
    ok: true,
    domain,
    mu,
    sigma,
    confidence_count,
    sensitivity: {
      acidity_sigma: clamp01(acidity_sigma),
      bitterness_sigma: clamp01(bitterness_sigma),
      most_sensitive,
    },
  });
}