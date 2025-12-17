"use client"; 

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import styles from "./LoginClient.module.css";

export default function LoginClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const sp = useSearchParams();

  const next = sp.get("next") || "/scan";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function signInMagicLink() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const e = email.trim();
      if (!e) throw new Error("Indtast email.");

      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: {
          // efter login lander vi tilbage hvor vi kom fra
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}${next}`
              : undefined,
        },
      });

      if (error) throw new Error(error.message);
      setMsg("Tjek din email — vi har sendt et login-link ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function signInPassword() {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const e = email.trim();
      if (!e) throw new Error("Indtast email.");
      if (!password) throw new Error("Indtast password.");

      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      });

      if (error) throw new Error(error.message);
      router.push(next);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.badge}>BrewNote</div>
          <h1 className={styles.h1}>Log ind</h1>
          <p className={styles.sub}>
            Log ind for at gemme i inventory og rate brews.
          </p>
        </div>

        <label className={styles.field}>
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dig@domain.dk"
            inputMode="email"
            autoComplete="email"
          />
        </label>

        <label className={styles.field}>
          <span>Password (valgfri)</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
          />
        </label>

        {(err || msg) && (
          <div className={styles.msg}>
            {err ? <div className={styles.err}>{err}</div> : null}
            {msg ? <div className={styles.ok}>{msg}</div> : null}
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.primary} onClick={signInMagicLink} disabled={busy}>
            {busy ? "Sender…" : "Send magic link"}
          </button>

          <button className={styles.secondary} onClick={signInPassword} disabled={busy}>
            {busy ? "Logger ind…" : "Log ind med password"}
          </button>
        </div>

        <div className={styles.back}>
          <button
            className={styles.ghost}
            type="button"
            onClick={() => router.push(next)}
          >
            Tilbage
          </button>
        </div>
      </div>
    </div>
  );
}