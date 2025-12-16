import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { fileName } = await req.json();

  const supabase = supabaseServer();

  const sessionId = crypto.randomUUID();
  const safeName = sanitize(fileName);
  const uploadPath = `public/${sessionId}-${safeName}`;

  const { error } = await supabase
    .from("scan_sessions")
    .insert({
      id: sessionId,
      user_id: null,
      image_path: uploadPath,
      extracted: {},
      status: "pending"
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