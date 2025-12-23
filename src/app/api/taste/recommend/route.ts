import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
 
type Domain = "coffee" | "tea";

const WEIGHTS: Record<Domain, Record<string, number>> = {
  coffee: { b: 1.0, a: 1.0, s: 0.8, m: 1.0, r: 0.9, c: 0.7 },
  tea: { b: 0.9, a: 0.6, s: 0.6, m: 0.5, r: 1.1, c: 1.2, t: 1.1 },
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function dist(domain: Domain, mu: any, p: any) {
  const w = WEIGHTS[domain];
  const keys = domain === "tea" ? ["b", "a", "s", "m", "r", "c", "t"] : ["b", "a", "s", "m", "r", "c"];
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
    .limit(200); // nok til v1

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const scored =
    (variants ?? [])
      .map((v: any) => {
        const { d, score } = dist(domain, mu, v.p);
        return {
          variant_id: v.variant_id,
          product_slug: v.product_slug,
          label: v.label,
          score,
          dist: d,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

  return NextResponse.json({ ok: true, items: scored });
}