import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Domain = "coffee" | "tea";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const domain = (url.searchParams.get("domain") || "coffee") as Domain;
  const limit = Number(url.searchParams.get("limit") || "12");

  if (domain !== "coffee" && domain !== "tea") {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("recommend_variants", {
    p_domain: domain,
    p_limit: Number.isFinite(limit) ? limit : 12,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, items: data ?? [] });
}