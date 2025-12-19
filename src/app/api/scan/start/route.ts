import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { fileName, contentType } = await req.json();

  const supabase = supabaseServer();

  // 1) kræv auth (så RLS + storage owner spiller)
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = crypto.randomUUID();
  const safeName = sanitize(fileName);

  // 2) upload path SKAL være "din egen mappe" i private bucket
  const uploadPath = `${user.id}/${sessionId}-${safeName}`;

  // 3) insert session med user_id (matcher RLS)
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