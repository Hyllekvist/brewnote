import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const { fileName } = await req.json();
  const supabase = supabaseServer();


  // kræver auth.uid() i RLS -> her bruger vi service role, så vi sætter user_id via JWT i næste iteration.
  // MVP: hvis du allerede har auth på client, så send userId med (eller brug cookies-based auth).
  // For nu: vi gemmer user_id = null og låser i næste iteration.
  const sessionId = crypto.randomUUID();
  const uploadPath = `anon/${sessionId}-${sanitize(fileName)}`;

  const { error } = await supabase.from("scan_sessions").insert({
    id: sessionId,
    user_id: null,
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