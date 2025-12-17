import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const h = req.headers.get("x-cron-secret");
  if (h && h === secret) return true;

  const url = new URL(req.url);
  return url.searchParams.get("key") === secret;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const variantId = body?.variantId as string | undefined;

    const supabase = supabaseServer();

    // Single recompute (best when user just rated)
    if (variantId) {
      const { data, error } = await supabase.rpc("recompute_variant_dna", {
        p_variant_id: variantId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, mode: "single", dna: data });
    }

    // Batch recompute (recent activity)
    const days = Number(body?.days ?? 7);
    const limit = Number(body?.limit ?? 200);

    const { data, error } = await supabase.rpc("recompute_recent_variant_dna", {
      p_days: Number.isFinite(days) ? days : 7,
      p_limit: Number.isFinite(limit) ? limit : 200,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, mode: "batch", recomputed: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Bad request" },
      { status: 400 }
    );
  }
}