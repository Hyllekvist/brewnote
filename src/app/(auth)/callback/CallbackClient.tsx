"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function CallbackClient() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/scan";

  useEffect(() => {
    const supabase = supabaseBrowser();

    // magiclink tokens ligger i URL-hash → supabase-js opsnapper dem her
    supabase.auth.getSession().finally(() => {
      router.replace(next);
    });
  }, [router, next]);

  return <div style={{ padding: 24 }}>Logger ind…</div>;
}