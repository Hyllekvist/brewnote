import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Domain = "coffee" | "tea";

function asNum(v: any, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const domain = (searchParams.get("domain") || "coffee") as Domain;
    if (domain !== "coffee" && domain !== "tea") {
      return NextResponse.json({ ok: false, error: "Invalid domain" }, { status: 400 });
    }

    // profile
    const { data: prof, error: profErr } = await supabase
      .from("user_domain_profiles")
      .select("mu, sigma, updated_at")
      .eq("user_id", auth.user.id)
      .eq("domain", domain)
      .maybeSingle();

    if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });

    // confidence: count reviews (v1)
    const { count, error: countErr } = await supabase
      .from("brew_reviews")
      .select("*", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("domain", domain);

    if (countErr) return NextResponse.json({ ok: false, error: countErr.message }, { status: 400 });

    const sigma = (prof?.sigma ?? null) as any;

    const sigA = sigma ? asNum(sigma.a, 0.35) : 0.35;
    const sigB = sigma ? asNum(sigma.b, 0.35) : 0.35;

    // lav sigma => høj følsomhed
    const mostSensitive =
      sigA === sigB ? null : sigA < sigB ? "acidity" : "bitterness";

    return NextResponse.json({
      ok: true,
      domain,
      mu: prof?.mu ?? null,
      sigma: prof?.sigma ?? null,
      updated_at: prof?.updated_at ?? null,
      confidence_count: count ?? 0,
      sensitivity: {
        acidity_sigma: sigA,
        bitterness_sigma: sigB,
        most_sensitive: mostSensitive,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}