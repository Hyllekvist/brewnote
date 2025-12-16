export function getUserKeyClient() {
  if (typeof window === "undefined") return "server";

  const existing = window.localStorage.getItem("brewnote_user_key");
  if (existing) return existing;

  const newKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `u_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  window.localStorage.setItem("brewnote_user_key", newKey);
  return newKey;
}

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // <- sørg for den hedder præcis sådan i Vercel
  if (!url || !anon) throw new Error("Missing Supabase env vars");
  return { url, anon };
}

export async function sbRest(path: string, init: RequestInit = {}, userKey?: string) {
  const { url, anon } = env();
  const headers = new Headers(init.headers);

  headers.set("apikey", anon);
  headers.set("Authorization", `Bearer ${anon}`);
  headers.set("Content-Type", "application/json");

  if (userKey) headers.set("x-user-key", userKey);

  const res = await fetch(`${url}${path}`, { ...init, headers, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : null;
}
