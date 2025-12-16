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

function formatPct(v?: number | null) {
  if (v == null) return null;
  return `${v}%`;
}

function cap(s?: string | null) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function confidenceLabel(c: number) {
  if (c >= 0.9) return "Meget høj";
  if (c >= 0.75) return "Høj";
  if (c >= 0.6) return "Middel";
  return "Lav";
}

export default function ScanClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const [result, setResult] = useState<ProcessResult | null>(null);
  const [detail, setDetail] = useState<VariantDetail | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);

  const [edit, setEdit] = useState<Extracted>({
    brand: "",
    line: "",
    name: "",
    size_g: undefined,
    form: "beans",
    intensity: undefined,
    arabica_pct: undefined,
    organic: undefined,
    ean: "",
  });

  function resetMessages() {
    setErr(null);
    setInfo(null);
    setSavedMsg(null);
  }

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
      ean: ex.ean ?? "",
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

  async function onScan() {
    resetMessages();
    setResult(null);
    setDetail(null);
    setEditOpen(false);
    if (!file) return;

    setBusy(true);

    try {
      // 1) start
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

      // 2) upload
      const { error: upErr } = await supabase.storage.from("scans").upload(uploadPath, file, {
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
      } else {
        setDetail(null);
      }

      if (data.status === "needs_user") {
        setInfo("Vi er tæt på — vælg et forslag eller ret info og prøv igen.");
        setEditOpen(true);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveExtractedAndRetry() {
    if (!result?.sessionId) return;
    resetMessages();
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
    resetMessages();
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

      const next: ProcessResult = {
        status: "resolved",
        sessionId: result.sessionId,
        confidence: j?.confidence ?? 0.92,
        extracted: j?.extracted ?? result.extracted,
        match: j?.match ?? null,
        suggestions: [],
      };

      setResult(next);
      loadEditFromResult(next);

      if (j?.match?.variant_id) {
        await loadDetails(j.match.variant_id);
      }
      setInfo("Produkt oprettet ✅");
      setEditOpen(false);
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onResolve(variantId: string) {
    if (!result?.sessionId) return;
    resetMessages();
    setBusy(true);

    try {
      const res = await fetch("/api/scan/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: result.sessionId, variantId }),
      });

      const text = await res.text();
      const j = safeJson(text);
      if (!res.ok) throw new Error(`resolve ${res.status}: ${j?.error ?? text}`);

      const next: ProcessResult = {
        ...(result as any),
        status: "resolved",
        confidence: j?.confidence ?? 0.9,
        match: j?.match ?? null,
        suggestions: [],
      };

      setResult(next);

      const vId = j?.match?.variant_id || variantId;
      if (vId) await loadDetails(vId);

      setInfo("Match valgt ✅");
      setEditOpen(false);
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveToInventory() {
    const variantId = detail?.variant?.id || result?.match?.variant_id;
    if (!variantId) return;

    resetMessages();
    setBusy(true);

    try {
      // pæn UX mens login ikke er implementeret færdigt
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setInfo("Log ind for at gemme i inventory (kommer lige om lidt).");
        return;
      }

      const res = await fetch("/api/inventory/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId }),
      });

      const text = await res.text();
      const j = safeJson(text);

      if (res.status === 401) {
        setInfo("Log ind for at gemme i inventory.");
        return;
      }

      if (!res.ok) throw new Error(`inventory ${res.status}: ${j?.error ?? text}`);

      setSavedMsg("Gemt i inventory ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  const c = result?.confidence ?? 0;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>BrewNote · Scan</div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.3 }}>Scan kaffe / te</h1>
        </div>
        <div style={{ fontSize: 12, opacity: 0.65, textAlign: "right" }}>
          {busy ? "Arbejder…" : result ? "Klar" : "Vælg et billede"}
        </div>
      </div>

      {/* Upload card */}
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Billede</div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {file.name} · {Math.round(file.size / 1024)} KB
              </div>
            )}
          </div>

          <button
            onClick={onScan}
            disabled={!file || busy}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: busy ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.10)",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 700,
              minWidth: 140,
            }}
          >
            {busy ? "Scanner…" : "Scan"}
          </button>
        </div>

        {/* Progress */}
        {busy && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
              Upload → Analyse → Match
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: "62%",
                  background: "rgba(255,255,255,0.28)",
                  borderRadius: 999,
                  transition: "width 300ms ease",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      {err && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(255,0,0,0.35)", background: "rgba(255,0,0,0.08)" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Fejl</div>
          <div style={{ whiteSpace: "pre-wrap", opacity: 0.92 }}>{err}</div>
        </div>
      )}

      {info && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)" }}>
          <div style={{ opacity: 0.95 }}>{info}</div>
        </div>
      )}

      {savedMsg && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(0,255,160,0.25)", background: "rgba(0,255,160,0.07)" }}>
          <div style={{ fontWeight: 800 }}>✅ {savedMsg}</div>
        </div>
      )}

      {/* Result layout */}
      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14, marginTop: 14 }}>
          {/* Main card */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Status: <b style={{ opacity: 1 }}>{result.status}</b>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Confidence: <b style={{ opacity: 1 }}>{Math.round(c * 100)}%</b> ({confidenceLabel(c)})
              </div>
            </div>

            {/* Match / Needs user */}
            {result.status === "resolved" && result.match && (
              <>
                <div style={{ marginTop: 12, fontSize: 20, fontWeight: 900, letterSpacing: -0.2 }}>
                  {result.match.brand} {result.match.line ? `${result.match.line} ` : ""}
                  {result.match.name}
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {result.match.size_g != null && <Chip>{result.match.size_g}g</Chip>}
                  {result.match.form && <Chip>{cap(result.match.form)}</Chip>}
                  {result.match.intensity != null && <Chip>Intensitet {result.match.intensity}/10</Chip>}
                  {result.match.arabica_pct != null && <Chip>Arabica {formatPct(result.match.arabica_pct)}</Chip>}
                  {result.match.organic != null && <Chip>{result.match.organic ? "Organic" : "Ikke organic"}</Chip>}
                </div>

                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={onSaveToInventory}
                    disabled={busy}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.10)",
                      cursor: busy ? "not-allowed" : "pointer",
                      fontWeight: 800,
                    }}
                  >
                    {busy ? "Gemmer…" : "Gem i inventory"}
                  </button>

                  <button
                    onClick={() => setEditOpen((v) => !v)}
                    disabled={busy}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "transparent",
                      cursor: busy ? "not-allowed" : "pointer",
                      fontWeight: 700,
                      opacity: 0.9,
                    }}
                  >
                    {editOpen ? "Skjul ret info" : "Ret info"}
                  </button>
                </div>
              </>
            )}

            {result.status === "needs_user" && (
              <>
                <div style={{ marginTop: 12, fontSize: 18, fontWeight: 900 }}>
                  Ingen sikker match endnu
                </div>

                {(result.suggestions ?? []).length > 0 ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {(result.suggestions ?? []).slice(0, 6).map((s) => (
                      <div
                        key={s.variant_id || s.label}
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.03)",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800 }}>{s.label}</div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Forslag · {Math.round(s.confidence * 100)}%
                          </div>
                        </div>

                        {s.variant_id ? (
                          <button
                            onClick={() => onResolve(s.variant_id)}
                            disabled={busy}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.18)",
                              background: "rgba(255,255,255,0.10)",
                              cursor: busy ? "not-allowed" : "pointer",
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Vælg
                          </button>
                        ) : (
                          <div style={{ fontSize: 12, opacity: 0.7 }}>Mangler variant</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, opacity: 0.8 }}>
                    Ingen forslag i DB endnu. Ret info og opret som nyt produkt.
                  </div>
                )}

                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setEditOpen(true)}
                    disabled={busy}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.10)",
                      cursor: busy ? "not-allowed" : "pointer",
                      fontWeight: 800,
                    }}
                  >
                    Ret info
                  </button>

                  <button
                    onClick={onCreateAsNewProduct}
                    disabled={busy || !result.sessionId}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.10)",
                      cursor: busy ? "not-allowed" : "pointer",
                      fontWeight: 800,
                    }}
                  >
                    Opret som nyt produkt
                  </button>
                </div>
              </>
            )}

            {/* Edit panel */}
            {editOpen && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Ret info</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Brand">
                    <input value={edit.brand ?? ""} onChange={(e) => setEdit((p) => ({ ...p, brand: e.target.value }))} />
                  </Field>

                  <Field label="Line">
                    <input value={edit.line ?? ""} onChange={(e) => setEdit((p) => ({ ...p, line: e.target.value }))} />
                  </Field>

                  <Field label="Name">
                    <input value={edit.name ?? ""} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} />
                  </Field>

                  <Field label="Størrelse (g)">
                    <input
                      inputMode="numeric"
                      value={edit.size_g ?? ""}
                      onChange={(e) => setEdit((p) => ({ ...p, size_g: e.target.value ? Number(e.target.value) : undefined }))}
                    />
                  </Field>

                  <Field label="Form">
                    <select value={edit.form ?? "beans"} onChange={(e) => setEdit((p) => ({ ...p, form: e.target.value as any }))}>
                      <option value="beans">beans</option>
                      <option value="ground">ground</option>
                    </select>
                  </Field>

                  <Field label="Organic">
                    <select
                      value={edit.organic === undefined ? "" : edit.organic ? "true" : "false"}
                      onChange={(e) => setEdit((p) => ({ ...p, organic: e.target.value === "" ? undefined : e.target.value === "true" }))}
                    >
                      <option value="">ukendt</option>
                      <option value="true">ja</option>
                      <option value="false">nej</option>
                    </select>
                  </Field>

                  <Field label="EAN (valgfri)">
                    <input value={edit.ean ?? ""} onChange={(e) => setEdit((p) => ({ ...p, ean: e.target.value }))} />
                  </Field>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={onSaveExtractedAndRetry}
                    disabled={busy || !result.sessionId}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.10)",
                      cursor: busy ? "not-allowed" : "pointer",
                      fontWeight: 800,
                    }}
                  >
                    {busy ? "Arbejder…" : "Gem & match igen"}
                  </button>

                  <button
                    onClick={onCreateAsNewProduct}
                    disabled={busy || !result.sessionId}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "transparent",
                      cursor: busy ? "not-allowed" : "pointer",
                      fontWeight: 800,
                      opacity: 0.95,
                    }}
                  >
                    Opret som nyt produkt
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Side card */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Produkt-info</div>

            {detail ? (
              <div style={{ display: "grid", gap: 12 }}>
                <InfoBlock title="Origin" value={detail.origin ? JSON.stringify(detail.origin) : "— (ingen origin endnu)"} />
                <InfoBlock title="DNA" value={detail.dna ? JSON.stringify(detail.dna) : "— (ingen dna endnu)"} />
                <InfoBlock
                  title="Anbefalet bryg"
                  value={
                    <>
                      <div style={{ fontWeight: 800 }}>
                        {detail.brew.method}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.85 }}>
                        Grind: {detail.brew.grind} · Ratio: {detail.brew.ratio} · Temp: {detail.brew.temp_c}°C
                      </div>
                      {detail.brew.notes ? (
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{detail.brew.notes}</div>
                      ) : null}
                    </>
                  }
                />
              </div>
            ) : (
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                Ingen detaljer endnu. Når et produkt er resolved, vises origin/dna/bryg her.
              </div>
            )}

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Tip</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Næste store win bliver barcode/EAN — det giver næsten perfekte matches.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- small UI helpers ---- */

function Chip({ children }: { children: any }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.04)",
        opacity: 0.95,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.75 }}>{label}</span>
      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.18)",
          padding: "8px 10px",
        }}
      >
        {children}
      </div>
    </label>
  );
}

function InfoBlock({ title, value }: { title: string; value: any }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.95, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}
