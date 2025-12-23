import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Domain = "coffee" | "tea";

const WEIGHTS: Record<Domain, Record<string, number>> = {
  coffee: { b: 1.0, a: 1.0, s: 0.8, m: 1.0, r: 0.9, c: 0.7 },
  tea: { b: 0.9, a: 0.6, s: 0.6, m: 0.5, r: 1.1, c: 1.2, t: 1.1 },
};

const AXES: Record<Domain, string[]> = {
  coffee: ["b", "a", "s", "m", "r", "c"],
  tea: ["b", "a", "s", "m", "r", "c", "t"],
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function dist(domain: Domain, mu: any, p: any) {
  const w = WEIGHTS[domain];
  const keys = AXES[domain];
  const wsum = keys.reduce((acc, k) => acc + (w[k] ?? 1), 0);

  let d = 0;
  for (const k of keys) {
    const wi = w[k] ?? 1;
    const a = clamp01(Number(mu?.[k] ?? 0.5));
    const b = clamp01(Number(p?.[k] ?? 0.5));
    d += wi * Math.abs(a - b);
  }

  const score = 1 - d / (wsum || 1);
  return { d, score };
}

// --- why helpers ---

function axisLabel(domain: Domain, axis: string) {
  const map: Record<string, string> = {
    b: "Bitterness",
    a: "Acidity",
    s: "Sweetness",
    m: "Body",
    r: "Aroma",
    c: "Clean finish",
    t: domain === "tea" ? "Astringency" : "Astringency",
  };
  return map[axis] ?? axis;
}

function directionPhrase(axis: string, delta: number) {
  // delta = (p - mu). Positive means "more than your preference".
  // We phrase as what the cup gives (for explainability).
  // Keep it short.
  const more = delta > 0;

  switch (axis) {
    case "b":
      return more ? "More bitter" : "Less bitter";
    case "a":
      return more ? "More acidic" : "Lower acidity";
    case "s":
      return more ? "Sweeter" : "Less sweet";
    case "m":
      return more ? "Fuller body" : "Lighter body";
    case "r":
      return more ? "More aroma" : "Less aroma";
    case "c":
      return more ? "Cleaner finish" : "Less clean finish";
    case "t":
      return more ? "More astringent" : "Less astringent";
    default:
      return more ? `More ${axis}` : `Less ${axis}`;
  }
}

function buildWhy(domain: Domain, mu: any, p: any) {
  const keys = AXES[domain];
  const w = WEIGHTS[domain];

  // compute weighted deltas
  const deltas = keys.map((k) => {
    const mui = clamp01(Number(mu?.[k] ?? 0.5));
    const pi = clamp01(Number(p?.[k] ?? 0.5));
    const wi = Number(w[k] ?? 1);
    const delta = pi - mui;
    return {
      axis: k,
      delta,
      abs: Math.abs(delta) * wi,
      mui,
      pi,
    };
  });

  // take top 2-3 most meaningful differences
  deltas.sort((a, b) => b.abs - a.abs);

  // ignore tiny diffs
  const top = deltas.filter((x) => x.abs >= 0.08).slice(0, 3);

  if (top.length === 0) {
    return ["Very close to your taste"];
  }

  // phrase as short “benefits”
  return top.map((x) => directionPhrase(x.axis, x.delta));
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const domain = (url.searchParams.get("domain") || "coffee") as Domain;
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || "10")));

  if (domain !== "coffee" && domain !== "tea") {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const { data: prof } = await supabase
    .from("user_domain_profiles")
    .select("mu")
    .eq("user_id", auth.user.id)
    .eq("domain", domain)
    .maybeSingle();

  const mu = prof?.mu ?? null;
  if (!mu) {
    return NextResponse.json({
      ok: true,
      items: [],
      note: "No profile yet. Rate 1-2 brews first.",
    });
  }

  const { data: variants, error } = await supabase
    .from("variant_taste_vectors")
    .select("variant_id, p, product_slug, label")
    .eq("domain", domain)
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const scored =
    (variants ?? [])
      .map((v: any) => {
        const { d, score } = dist(domain, mu, v.p);
        const why = buildWhy(domain, mu, v.p);
        return {
          variant_id: v.variant_id,
          product_slug: v.product_slug,
          label: v.label,
          score,
          dist: d,
          why, // ✅ new
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

  return NextResponse.json({ ok: true, items: scored });
}