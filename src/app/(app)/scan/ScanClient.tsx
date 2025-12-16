"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type ProcessResult = {
  status: "resolved" | "needs_user" | "failed";
  sessionId: string;
  confidence: number;
  extracted: Record<string, any>;
  match?: {
    product_id: string;
    variant_id: string;
    brand: string;
    name: string;
    line?: string | null;
    size_g?: number | null;
    form?: string | null;
    intensity?: number | null;
    arabica_pct?: number | null;
    organic?: boolean | null;
  };
  suggestions?: Array<{
    variant_id: string;
    label: string;
    confidence: number;
  }>;
};

export default function ScanClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onScan() {
    setErr(null);
    setResult(null);
    if (!file) return;

    setBusy(true);
    try {
      // 1) start session (server returns uploadPath)
      const startRes = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "image/jpeg",
        }),
      });

      if (!startRes.ok) throw new Error("start failed");
      const { sessionId, uploadPath } = await startRes.json();

      // 2) upload to Supabase storage
      const { error: upErr } = await supabase.storage
        .from("scans")
        .upload(uploadPath, file, {
          contentType: file.type || "image/jpeg",
          upsert: true,
        });
      if (upErr) throw upErr;

      // 3) process (mock OCR v1)
      const procRes = await fetch("/api/scan/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!procRes.ok) throw new Error("process failed");
      const data: ProcessResult = await procRes.json();
      setResult(data);
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ margin: "8px 0 12px" }}>Scan kaffe/te</h1>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={onScan} disabled={!file || busy}>
          {busy ? "Scanner..." : "Scan"}
        </button>
      </div>

      {err && (
        <p style={{ marginTop: 12, color: "crimson" }}>
          {err}
        </p>
      )}

      {result && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #333", borderRadius: 12 }}>
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            Status: <b>{result.status}</b> · Confidence: <b>{Math.round(result.confidence * 100)}%</b>
          </div>

          {result.match ? (
            <>
              <h3 style={{ margin: "10px 0 6px" }}>
                {result.match.brand} {result.match.line ? `${result.match.line} ` : ""}{result.match.name}
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.match.size_g != null && <li>Størrelse: {result.match.size_g}g</li>}
                {result.match.form && <li>Form: {result.match.form}</li>}
                {result.match.intensity != null && <li>Intensitet: {result.match.intensity}/10</li>}
                {result.match.arabica_pct != null && <li>Arabica: {result.match.arabica_pct}%</li>}
                {result.match.organic != null && <li>Organic: {result.match.organic ? "Ja" : "Nej"}</li>}
              </ul>
            </>
          ) : (
            <>
              <p style={{ marginTop: 10 }}>Ingen sikker match. Forslag:</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(result.suggestions ?? []).map((s) => (
                  <li key={s.variant_id}>
                    {s.label} ( {Math.round(s.confidence * 100)}% )
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}