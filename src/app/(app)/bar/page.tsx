import Link from "next/link";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  user_key: string;
  product_slug: string;
  created_at: string;
};

function productHref(slug: string) {
  const s = slug.toLowerCase();
  const isTea = s.startsWith("tea-") || s.includes("tea") || s.includes("matcha");
  return isTea ? `/teas/${slug}` : `/coffees/${slug}`;
}

export default function BarPage() {
  return (
    <main style={{ padding: 16, maxWidth: 680, margin: "0 auto" }}>
      <h1 style={{ margin: "6px 0 10px" }}>Din Bar</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>
        Det du har tilføjet — klar til bryg og noter.
      </p>

      <BarClient />
    </main>
  );
}

// --- client part (localStorage + fetch) ---
function BarClient() {
  return <BarClientInner />;
}

function BarClientInner() {
  // This component must be client to read localStorage
  // but we keep file simple without extra CSS for now.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const React = require("react");
  const { useEffect, useState } = React as typeof import("react");

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function getUserKey() {
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

  useEffect(() => {
    const user_key = getUserKey();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!url || !anon) {
          throw new Error("Missing Supabase env vars");
        }

        // REST read
        const res = await fetch(
          `${url}/rest/v1/inventory?select=id,user_key,product_slug,created_at&user_key=eq.${encodeURIComponent(
            user_key
          )}&order=created_at.desc`,
          {
            headers: {
              apikey: anon,
              Authorization: `Bearer ${anon}`,
            },
            cache: "no-store",
          }
        );

        const text = await res.text();
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

        const data = JSON.parse(text) as Item[];
        setItems(data);
      } catch (e: any) {
        setError(e?.message || "Kunne ikke hente Bar");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <div style={{ opacity: 0.75 }}>Indlæser…</div>;

  if (error)
    return (
      <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Fejl</div>
        <div style={{ opacity: 0.8, whiteSpace: "pre-wrap" }}>{error}</div>
      </div>
    );

  if (!items.length)
    return (
      <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Din Bar er tom</div>
        <div style={{ opacity: 0.75 }}>
          Gå ind på en kaffe eller te og tryk <strong>“Tilføj til Bar”</strong>.
        </div>
        <div style={{ marginTop: 10 }}>
          <Link href="/coffees/espresso-blend" style={{ textDecoration: "underline" }}>
            Åbn en kaffe →
          </Link>
        </div>
      </div>
    );

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      {items.map((it) => (
        <Link
          key={it.id}
          href={productHref(it.product_slug)}
          style={{
            display: "block",
            padding: 14,
            borderRadius: 16,
            textDecoration: "none",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Tilføjet</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>
            {it.product_slug.replaceAll("-", " ")}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Åbn produkt →
          </div>
        </Link>
      ))}
    </div>
  );
}