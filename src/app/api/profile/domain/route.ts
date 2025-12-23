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

    const user_id = auth.user.id;

    const { data: prof, error: profErr } = await supabase
      .from("user_domain_profiles")
      .select("mu, sigma, beta, updated_at")
      .eq("user_id", user_id)
      .eq("domain", domain)
      .maybeSingle();

    if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });

    // confidence = antal brew_reviews
    const { count, error: countErr } = await supabase
      .from("brew_reviews")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("domain", domain);

    if (countErr) return NextResponse.json({ ok: false, error: countErr.message }, { status: 400 });

    const sigma = prof?.sigma ?? null;

    const aciditySigma = sigma ? asNum((sigma as any).a, 0.35) : 0.35;
    const bitternessSigma = sigma ? asNum((sigma as any).b, 0.35) : 0.35;

    const mostSensitive =
      aciditySigma === bitternessSigma ? null : aciditySigma < bitternessSigma ? "acidity" : "bitterness";

    return NextResponse.json({
      ok: true,
      domain,
      mu: prof?.mu ?? null,
      sigma: prof?.sigma ?? null,
      beta: prof?.beta ?? null,
      updated_at: prof?.updated_at ?? null,
      confidence_count: count ?? 0,
      sensitivity: {
        acidity_sigma: aciditySigma,
        bitterness_sigma: bitternessSigma,
        most_sensitive: mostSensitive,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}