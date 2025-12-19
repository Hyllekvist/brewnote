import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const fileName = body?.fileName as string | undefined;

  const supabase = supabaseServer();

  // ✅ kræv login (matcher RLS + storage own_scans)
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user;

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = crypto.randomUUID();
  const safeName = sanitize(fileName ?? "scan.jpg");

  // ✅ upload under userId så storage owner policies giver mening
  // (ScanClient bruger uploadPath direkte)
  const uploadPath = `${user.id}/${sessionId}-${safeName}`;

  const { error } = await supabase.from("scan_sessions").insert({
    id: sessionId,
    user_id: user.id,
    image_path: uploadPath,
    extracted: {},
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ sessionId, uploadPath });
}

function sanitize(name: string) {
  return String(name || "scan.jpg")
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .slice(0, 80);
}