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

type VariantDetail = {
  variant: {
    id: string;
    product_id: string;
    size_g?: number | null;
    form?: string | null;
    intensity?: number | null;
    arabica_pct?: number | null;
    organic?: boolean | null;
  };
  product: {
    id: string;
    brand: string;
    line?: string | null;
    name: string;
  };
  origin: any | null;
  dna: any | null;
  brew: {
    method: string;
    grind: string;
    ratio: string;
    temp_c: number;
    notes?: string;
  };
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

  const [detail, setDetail] = useState<VariantDetail | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

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

  async function loadDetails(variantId: string) {
    setDetail(null);
    const res = await fetch(`/api/products/variant/${variantId}`, { method: "GET" });
    const text = await res.text();
    const j = safeJson(text);

    if (!res.ok) throw new Error(`detail ${res.status}: ${j?.error ?? text}`);
    setDetail(j as VariantDetail);
  }

  async function onScan() {
    setErr(null);
    setSavedMsg(null);
    setResult(null);
    setDetail(null);
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

      if (data.status === "resolved" && data.match?.variant_id) {
        await loadDetails(data.match.variant_id);
      }
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
    setSavedMsg(null);
    setBusy(true);

    try {
      await saveExtracted();

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

      if (data.status === "resolved" && data.match?.variant_id) {
        await loadDetails(data.match.variant_id);
      } else {
        setDetail(null);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateAsNewProduct() {
    if (!result?.sessionId) return;

    setErr(null);
    setSavedMsg(null);
    setBusy(true);

    try {
      await saveExtracted();

      const res = await fetch("/api/scan/create-product-from-extracted", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: result.sessionId }),
      });

      const text = await res.text();
      const j = safeJson(text);

      if (!res.ok) throw new Error(`create-product ${res.status}: ${j?.error ?? text}`);

      setResult((prev) => ({
        ...(prev ?? ({} as any)),
        status: "resolved",
        confidence: j?.confidence ?? 0.92,
        match: j?.match ?? null,
        suggestions: [],
        extracted: j?.extracted ?? (prev?.extracted ?? {}),
      }));

      if (j?.match?.variant_id) {
        await loadDetails(j.match.variant_id);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveToInventory() {
    const variantId = detail?.variant?.id || result?.match?.variant_id;
    if (!variantId) return;

    setErr(null);
    setSavedMsg(null);
    setBusy(true);

    try {
      const res = await fetch("/api/inventory/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId }),
      });

      const text = await res.text();
      const j = safeJson(text);

      if (!res.ok) throw new Error(`inventory ${res.status}: ${j?.error ?? text}`);
      setSavedMsg("Gemt i inventory ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 16 }}>
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

      {savedMsg && (
        <p style={{ marginTop: 12, color: "limegreen" }}>{savedMsg}</p>
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

          {/* Detail card */}
          {detail && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #222" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Produkt-info</div>

              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Origin</div>
                  <div style={{ opacity: 0.95 }}>
                    {detail.origin
                      ? JSON.stringify(detail.origin)
                      : "— (ingen origin endnu)"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>DNA</div>
                  <div style={{ opacity: 0.95 }}>
                    {detail.dna ? JSON.stringify(detail.dna) : "— (ingen dna endnu)"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Anbefalet bryg</div>
                  <div style={{ opacity: 0.95 }}>
                    <b>{detail.brew.method}</b> · Grind: {detail.brew.grind} · Ratio:{" "}
                    {detail.brew.ratio} · Temp: {detail.brew.temp_c}°C
                    {detail.brew.notes ? (
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                        {detail.brew.notes}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <button onClick={onSaveToInventory} disabled={busy}>
                  {busy ? "Gemmer..." : "Gem i inventory"}
                </button>
              </div>
            </div>
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
