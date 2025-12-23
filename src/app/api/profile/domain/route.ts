import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Domain = "coffee" | "tea";

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

    // 1) profile (mu + sigma)
    const { data: prof, error: profErr } = await supabase
      .from("user_domain_profiles")
      .select("mu, sigma, updated_at")
      .eq("user_id", auth.user.id)
      .eq("domain", domain)
      .maybeSingle();

    if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });

    // 2) confidence count = antal brew_reviews (stars) for domænet
    const { count, error: countErr } = await supabase
      .from("brew_reviews")
      .select("*", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("domain", domain);

    if (countErr) return NextResponse.json({ ok: false, error: countErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      mu: prof?.mu ?? null,
      sigma: prof?.sigma ?? null,
      updated_at: prof?.updated_at ?? null,
      count: count ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}