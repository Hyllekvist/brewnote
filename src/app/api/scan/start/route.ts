import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { fileName } = await req.json();
  const supabase = createClient();

  // 1. kræv login
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. opret scan-session
  const sessionId = crypto.randomUUID();
  const safeName = sanitize(fileName);
  const uploadPath = `${user.id}/${sessionId}-${safeName}`;

  const { error: insertError } = await supabase
    .from("scan_sessions")
    .insert({
      id: sessionId,
      user_id: user.id,
      image_path: uploadPath,
      extracted: {},
      status: "pending",
    });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ sessionId, uploadPath });
}

function sanitize(name: string) {
  return String(name || "scan.jpg")
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .slice(0, 80);
}