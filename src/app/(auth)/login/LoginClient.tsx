"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const search = useSearchParams();
  const router = useRouter();

  const next = search.get("next") || "/";

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onMagicLink() {
    setErr(null);
    setMsg(null);
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${next}` },
      });
      if (error) throw new Error(error.message);
      setMsg("Tjek din email for login-link ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: 0 }}>Login</h1>
      <p style={{ opacity: 0.7 }}>Få et magic link på email.</p>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="din@email.dk"
        inputMode="email"
        style={{ width: "100%", padding: 12, borderRadius: 12, marginTop: 10 }}
      />

      <button
        onClick={onMagicLink}
        disabled={busy || !email.includes("@")}
        style={{ width: "100%", padding: 12, borderRadius: 999, marginTop: 12 }}
      >
        {busy ? "Sender…" : "Send login-link"}
      </button>

      {err ? <div style={{ color: "#ff4d5e", marginTop: 10 }}>{err}</div> : null}
      {msg ? <div style={{ color: "#1fa97b", marginTop: 10 }}>{msg}</div> : null}
    </div>
  );
}