"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Match = {
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

type Suggestion = {
  variant_id: string;
  label: string;
  confidence: number;
};

type Extracted = {
  brand?: string;
  line?: string;
  name?: string;
  size_g?: number;
  form?: "beans" | "ground";
  intensity?: number;
  arabica_pct?: number;
  organic?: boolean;
  ean?: string;
};

type ProcessResult = {
  status: "resolved" | "needs_user" | "failed";
  sessionId: string;
  confidence: number;
  extracted: Record<string, any>;
  match?: Match | null;
  suggestions?: Suggestion[];
};

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function ScanClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Manual extracted editor (MVP)
  const [edit, setEdit] = useState<Extracted>({
    brand: "",
    line: "",
    name: "",
    size_g: undefined,
    form: "beans",
    intensity: undefined,
    arabica_pct: undefined,
    organic: undefined,
  });

  function loadEditFromResult(r: ProcessResult) {
    const ex = (r.extracted ?? {}) as Extracted;
    setEdit({
      brand: ex.brand ?? "",
      line: ex.line ?? "",
      name: ex.name ?? "",
      size_g: ex.size_g,
      form: (ex.form as any) ?? "beans",
      intensity: ex.intensity,
      arabica_pct: ex.arabica_pct,
      organic: ex.organic,
      ean: ex.ean,
    });
  }

  async function onScan() {
    setErr(null);
    setResult(null);
    if (!file) return;

    setBusy(true);

    try {
      // 1) start scan
      const startRes = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "image/jpeg",
        }),
      });

      if (!startRes.ok) {
        const text = await startRes.text();
        const j = safeJson(text);
        throw new Error(`start ${startRes.status}: ${j?.error ?? text}`);
      }

      const { sessionId, uploadPath } = await startRes.json();
      if (!sessionId || !uploadPath) throw new Error("start: missing sessionId/uploadPath");

      // 2) upload image
      const { error: upErr } = await supabase.storage
        .from("scans")
        .upload(uploadPath, file, {
          contentType: file.type || "image/jpeg",
          upsert: true,
        });

      if (upErr) throw new Error(`upload: ${upErr.message}`);

      // 3) process
      const procRes = await fetch("/api/scan/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!procRes.ok) {
        const text = await procRes.text();
        const j = safeJson(text);
        throw new Error(`process ${procRes.status}: ${j?.error ?? text}`);
      }

      const data: ProcessResult = await procRes.json();
      setResult(data);
      loadEditFromResult(data);
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onResolve(variantId: string) {
    if (!result?.sessionId) return;

    setErr(null);
    setBusy(true);

    try {
      const res = await fetch("/api/scan/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: result.sessionId,
          variantId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        const j = safeJson(text);
        throw new Error(`resolve ${res.status}: ${j?.error ?? text}`);
      }

      const data = await res.json();

      setResult((prev) => ({
        ...(prev ?? ({} as any)),
        status: "resolved",
        confidence: data.confidence ?? 0.9,
        match: data.match ?? null,
        suggestions: [],
      }));
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function saveExtracted() {
    if (!result?.sessionId) throw new Error("Missing sessionId");

    const updRes = await fetch("/api/scan/update-extracted", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: result.sessionId,
        extracted: {
          brand: edit.brand?.trim() || undefined,
          line: edit.line?.trim() || undefined,
          name: edit.name?.trim() || undefined,
          size_g: edit.size_g ? Number(edit.size_g) : undefined,
          form: edit.form,
          intensity: edit.intensity != null ? Number(edit.intensity) : undefined,
          arabica_pct: edit.arabica_pct != null ? Number(edit.arabica_pct) : undefined,
          organic: edit.organic,
          ean: edit.ean?.trim() || undefined,
        },
      }),
    });

    if (!updRes.ok) {
      const text = await updRes.text();
      const j = safeJson(text);
      throw new Error(`update-extracted ${updRes.status}: ${j?.error ?? text}`);
    }
  }

  async function onSaveExtractedAndRetry() {
    if (!result?.sessionId) return;

    setErr(null);
    setBusy(true);

    try {
      // 1) save extracted
      await saveExtracted();

      // 2) run process again (now it should use session.extracted)
      const procRes = await fetch("/api/scan/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: result.sessionId }),
      });

      if (!procRes.ok) {
        const text = await procRes.text();
        const j = safeJson(text);
        throw new Error(`process ${procRes.status}: ${j?.error ?? text}`);
      }

      const data: ProcessResult = await procRes.json();
      setResult(data);
      loadEditFromResult(data);
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateAsNewProduct() {
    if (!result?.sessionId) return;

    setErr(null);
    setBusy(true);

    try {
      // 1) GEM edit -> session.extracted (ellers bruger create-route gammel extracted)
      await saveExtracted();

      // 2) create product from extracted
      const res = await fetch("/api/scan/create-product-from-extracted", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: result.sessionId }),
      });

      const text = await res.text();
      const j = safeJson(text);

      console.log("create-product status:", res.status);
      console.log("create-product raw:", text);
      console.log("create-product json:", j);

      if (!res.ok) {
        throw new Error(`create-product ${res.status}: ${j?.error ?? text}`);
      }

      // forventer { status, confidence, match, extracted? }
      setResult((prev) => ({
        ...(prev ?? ({} as any)),
        status: "resolved",
        confidence: j?.confidence ?? 0.92,
        match: j?.match ?? null,
        suggestions: [],
        extracted: j?.extracted ?? (prev?.extracted ?? {}),
      }));

      // valgfrit: opdatér editor til det vi lige har gemt
      // (ellers står den allerede rigtigt)
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Scan kaffe/te</h1>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button onClick={onScan} disabled={!file || busy}>
          {busy ? "Scanner..." : "Scan"}
        </button>
      </div>

      {err && (
        <p style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </p>
      )}

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            border: "1px solid #333",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Status: <b>{result.status}</b> · Confidence:{" "}
            <b>{Math.round(result.confidence * 100)}%</b>
          </div>

          {/* Result */}
          {result.match && (
            <>
              <h3 style={{ marginTop: 10 }}>
                {result.match.brand} {result.match.line ? `${result.match.line} ` : ""}
                {result.match.name}
              </h3>
              <ul style={{ marginTop: 8 }}>
                {result.match.size_g != null && <li>Størrelse: {result.match.size_g}g</li>}
                {result.match.form && <li>Form: {result.match.form}</li>}
                {result.match.intensity != null && <li>Intensitet: {result.match.intensity}/10</li>}
                {result.match.arabica_pct != null && <li>Arabica: {result.match.arabica_pct}%</li>}
                {result.match.organic != null && <li>Organic: {result.match.organic ? "Ja" : "Nej"}</li>}
              </ul>
            </>
          )}

          {result.status === "needs_user" && (
            <>
              <p style={{ marginTop: 10, marginBottom: 8 }}>
                Ingen sikker match. Vælg et forslag — eller ret info og prøv igen:
              </p>

              {(result.suggestions ?? []).length > 0 && (
                <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
                  {(result.suggestions ?? []).map((s) => (
                    <li key={s.variant_id || s.label} style={{ marginBottom: 8 }}>
                      {s.variant_id ? (
                        <button onClick={() => onResolve(s.variant_id)} disabled={busy}>
                          Vælg: {s.label} ({Math.round(s.confidence * 100)}%)
                        </button>
                      ) : (
                        <span>
                          {s.label} ({Math.round(s.confidence * 100)}%)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Manual edit extracted */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #222" }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Ret info (MVP)</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Brand</span>
                <input
                  value={edit.brand ?? ""}
                  onChange={(e) => setEdit((p) => ({ ...p, brand: e.target.value }))}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Line</span>
                <input
                  value={edit.line ?? ""}
                  onChange={(e) => setEdit((p) => ({ ...p, line: e.target.value }))}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Name</span>
                <input
                  value={edit.name ?? ""}
                  onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Størrelse (g)</span>
                <input
                  inputMode="numeric"
                  value={edit.size_g ?? ""}
                  onChange={(e) =>
                    setEdit((p) => ({
                      ...p,
                      size_g: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Form</span>
                <select
                  value={edit.form ?? "beans"}
                  onChange={(e) => setEdit((p) => ({ ...p, form: e.target.value as any }))}
                >
                  <option value="beans">beans</option>
                  <option value="ground">ground</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Organic</span>
                <select
                  value={edit.organic === undefined ? "" : edit.organic ? "true" : "false"}
                  onChange={(e) =>
                    setEdit((p) => ({
                      ...p,
                      organic: e.target.value === "" ? undefined : e.target.value === "true",
                    }))
                  }
                >
                  <option value="">ukendt</option>
                  <option value="true">ja</option>
                  <option value="false">nej</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button onClick={onSaveExtractedAndRetry} disabled={busy || !result?.sessionId}>
                {busy ? "Arbejder..." : "Gem & match igen"}
              </button>

              <button onClick={onCreateAsNewProduct} disabled={busy || !result?.sessionId}>
                {busy ? "Opretter..." : "Opret som nyt produkt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
