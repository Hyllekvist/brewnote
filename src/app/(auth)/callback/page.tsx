"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function CallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/scan";

  useEffect(() => {
    const supabase = supabaseBrowser();

    // ✅ læser tokens fra URL-hash og etablerer session
    supabase.auth.getSession().finally(() => {
      router.replace(next);
    });
  }, [router, next]);

  return <div style={{ padding: 24 }}>Logger ind…</div>;
}