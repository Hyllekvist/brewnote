"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type ScanRow = {
  id: string;
  image_path: string;
  status: "pending" | "processed" | "failed";
  created_at: string;
};

export default function ScanResultClient({ id }: { id: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [row, setRow] = useState<ScanRow | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push(`/login?next=${encodeURIComponent(`/scan/${id}`)}`);
        return;
      }

      const { data, error } = await supabase
        .from("scans")
        .select("id,image_path,status,created_at")
        .eq("id", id)
        .single();

      if (!alive) return;

      if (error) {
        setErr(error.message);
        return;
      }

      setRow(data as ScanRow);

      // Private bucket → signed URL
      const { data: signed, error: sErr } = await supabase.storage
        .from("scans")
        .createSignedUrl((data as any).image_path, 60 * 10);

      if (!alive) return;

      if (sErr) {
        setErr(sErr.message);
        return;
      }

      setImgUrl(signed?.signedUrl ?? null);
    })();

    return () => {
      alive = false;
    };
  }, [id, router, supabase]);

  if (err) return <div style={{ padding: 24, color: "#ff4d5e" }}>{err}</div>;
  if (!row) return <div style={{ padding: 24 }}>Henter scan…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Scan</h1>
      <p style={{ opacity: 0.7, marginTop: 6 }}>
        Status: <b>{row.status}</b>
      </p>

      {imgUrl ? (
        <img
          src={imgUrl}
          alt="Scan"
          style={{ width: "100%", borderRadius: 18, marginTop: 12 }}
        />
      ) : null}

      <div style={{ marginTop: 14, opacity: 0.7 }}>
        Næste: vi tilføjer “mock-resultat” + status=processed.
      </div>
    </div>
  );
}