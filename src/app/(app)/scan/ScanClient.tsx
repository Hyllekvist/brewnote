"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import styles from "./ScanClient.module.css";

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
  product: { id: string; brand: string; line?: string | null; name: string };
  origin: any | null;
  dna: any | null;
  brew: { method: string; grind: string; ratio: string; temp_c: number; notes?: string };
};

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default function ScanClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [detail, setDetail] = useState<VariantDetail | null>(null);

  const [toast, setToast] = useState<{ type: "ok" | "bad"; msg: string } | null>(null);
  const [showEdit, setShowEdit] = useState(true);

  const [edit, setEdit] = useState<Extracted>({
    brand: "",
    line: "",
    name: "",
    size_g: undefined,
    form: "beans",
    organic: undefined,
    ean: "",
  });

  function setError(msg: string) {
    setToast({ type: "bad", msg });
  }
  function setOk(msg: string) {
    setToast({ type: "ok", msg });
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
    const res = await fetch(`/api/products/variant/${variantId}`);
    const text = await res.text();
    const j = safeJson(text);
    if (!res.ok) throw new Error(`detail ${res.status}: ${j?.error ?? text}`);
    setDetail(j as VariantDetail);
  }

  async function saveExtracted(sessionId: string) {
    const updRes = await fetch("/api/scan/update-extracted", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
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
    if (!file) return;
    setToast(null);
    setBusy(true);
    setResult(null);
    setDetail(null);

    try {
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

      const { error: upErr } = await supabase.storage
        .from("scans")
        .upload(uploadPath, file, { contentType: file.type || "image/jpeg", upsert: true });

      if (upErr) throw new Error(`upload: ${upErr.message}`);

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

      setOk(`Scan færdig · ${pct(data.confidence)}`);
      setShowEdit(data.status !== "resolved"); // auto-fold edit hvis vi er resolved
    } catch (e: any) {
      setError(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveExtractedAndRetry() {
    if (!result?.sessionId) return;
    setToast(null);
    setBusy(true);

    try {
      await saveExtracted(result.sessionId);

      const procRes = await fetch("/api/scan/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: result.sessionId }),
      });

      const text = await procRes.text();
      const j = safeJson(text);

      if (!procRes.ok) throw new Error(`process ${procRes.status}: ${j?.error ?? text}`);

      const data: ProcessResult = j;
      setResult(data);
      loadEditFromResult(data);

      if (data.status === "resolved" && data.match?.variant_id) {
        await loadDetails(data.match.variant_id);
        setShowEdit(false);
      } else {
        setDetail(null);
        setShowEdit(true);
      }

      setOk(`Opdateret · ${pct(data.confidence)}`);
    } catch (e: any) {
      setError(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateAsNewProduct() {
    if (!result?.sessionId) return;
    setToast(null);
    setBusy(true);

    try {
      await saveExtracted(result.sessionId);

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

      if (j?.match?.variant_id) await loadDetails(j.match.variant_id);

      setOk("Nyt produkt oprettet ✅");
      setShowEdit(false);
    } catch (e: any) {
      setError(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveToInventory() {
    const variantId = detail?.variant?.id || result?.match?.variant_id;
    if (!variantId) return;

    setToast(null);
    setBusy(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Du skal være logget ind for at gemme i inventory.");

      const res = await fetch("/api/inventory/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId, qty: 1 }),
      });

      const text = await res.text();
      const j = safeJson(text);

      if (res.status === 401) throw new Error("Du skal være logget ind for at gemme i inventory.");
      if (!res.ok) throw new Error(j?.error ?? text);

      setOk("Gemt i inventory ✅");
    } catch (e: any) {
      setError(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  const statusPill = (() => {
    if (!result) return null;
    const s = result.status;
    const conf = result.confidence ?? 0;
    if (s === "resolved") return <span className={`${styles.pill} ${styles.pillOk}`}>Resolved · {pct(conf)}</span>;
    if (s === "needs_user") return <span className={`${styles.pill} ${styles.pillWarn}`}>Needs help · {pct(conf)}</span>;
    return <span className={`${styles.pill} ${styles.pillBad}`}>Failed</span>;
  })();

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.h1}>Scan kaffe/te</h1>
          <div className={styles.sub}>Scan posen → match produkt → gem</div>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Left: Scan hero + result */}
        <div className={styles.card}>
          <div className={styles.fileRow}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className={styles.fileName}>{file ? file.name : "Vælg et billede"}</div>
          </div>

          <div className={styles.scanHero} style={{ marginTop: 12 }}>
            <div className={styles.scanIcon}>
              <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M7 3h10a2 2 0 0 1 2 2v2h-2V5H7v2H5V5a2 2 0 0 1 2-2Zm12 8h2v8a2 2 0 0 1-2 2h-2v-2h2v-8ZM5 11H3v8a2 2 0 0 0 2 2h2v-2H5v-8Zm4-3h6a2 2 0 0 1 2 2v8H7v-8a2 2 0 0 1 2-2Zm0 2v6h6v-6H9Z"
                />
              </svg>
            </div>
            <h3 className={styles.scanTitle}>Scan posen</h3>
            <div className={styles.scanHint}>Peg kameraet mod forsiden. Godt lys. Ingen blur.</div>

            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onScan} disabled={!file || busy}>
                {busy ? <><span className={styles.spin} />Scanner...</> : "Scan"}
              </button>
            </div>
          </div>

          {toast && (
            <div className={`${styles.toast} ${toast.type === "ok" ? styles.toastOk : styles.toastBad}`}>
              {toast.msg}
            </div>
          )}

          {result && (
            <div style={{ marginTop: 12 }}>
              <div className={styles.pillRow}>{statusPill}</div>

              {result.match && (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 4 }}>
                    {result.match.brand} {result.match.line ? `${result.match.line} ` : ""}{result.match.name}
                  </div>

                  <div className={styles.kv}>
                    {result.match.size_g != null && (
                      <div className={styles.kvRow}>
                        <div className={styles.kvLabel}>Størrelse</div>
                        <div className={styles.kvVal}>{result.match.size_g}g</div>
                      </div>
                    )}
                    {result.match.form && (
                      <div className={styles.kvRow}>
                        <div className={styles.kvLabel}>Form</div>
                        <div className={styles.kvVal}>{result.match.form}</div>
                      </div>
                    )}
                    {result.match.intensity != null && (
                      <div className={styles.kvRow}>
                        <div className={styles.kvLabel}>Intensitet</div>
                        <div className={styles.kvVal}>{result.match.intensity}/10</div>
                      </div>
                    )}
                    {result.match.arabica_pct != null && (
                      <div className={styles.kvRow}>
                        <div className={styles.kvLabel}>Arabica</div>
                        <div className={styles.kvVal}>{result.match.arabica_pct}%</div>
                      </div>
                    )}
                    {result.match.organic != null && (
                      <div className={styles.kvRow}>
                        <div className={styles.kvLabel}>Organic</div>
                        <div className={styles.kvVal}>{result.match.organic ? "Ja" : "Nej"}</div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {result.status === "needs_user" && (
                <div style={{ marginTop: 10, opacity: 0.9 }}>
                  Ingen sikker match. Ret info nedenfor eller opret som nyt produkt.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Product details + actions */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Produkt-info</h3>

          {!detail ? (
            <div style={{ opacity: 0.7 }}>
              Scan et produkt for at se anbefalet bryg, DNA og origin.
            </div>
          ) : (
            <>
              <div className={styles.kv}>
                <div className={styles.kvRow}>
                  <div className={styles.kvLabel}>Origin</div>
                  <div className={styles.kvVal}>{detail.origin ? "✅" : "—"}</div>
                </div>
                <div className={styles.kvRow}>
                  <div className={styles.kvLabel}>DNA</div>
                  <div className={styles.kvVal}>{detail.dna ? "✅" : "—"}</div>
                </div>
                <div className={styles.kvRow}>
                  <div className={styles.kvLabel}>Anbefalet bryg</div>
                  <div className={styles.kvVal}>
                    {detail.brew.method} · {detail.brew.ratio} · {detail.brew.temp_c}°C
                  </div>
                </div>
              </div>

              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onSaveToInventory} disabled={busy}>
                  {busy ? <><span className={styles.spin} />Gemmer...</> : "Gem i inventory"}
                </button>
              </div>
            </>
          )}

          {/* Edit sheet */}
          {result && (
            <div className={styles.sheet}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 750 }}>Ret info</div>
                <button className={styles.btn} onClick={() => setShowEdit((v) => !v)} disabled={busy}>
                  {showEdit ? "Skjul" : "Vis"}
                </button>
              </div>

              {showEdit && (
                <>
                  <div className={styles.formGrid} style={{ marginTop: 10 }}>
                    <label className={styles.field}>
                      <span className={styles.label}>Brand</span>
                      <input className={styles.input} value={edit.brand ?? ""} onChange={(e) => setEdit(p => ({...p, brand: e.target.value}))} />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Line</span>
                      <input className={styles.input} value={edit.line ?? ""} onChange={(e) => setEdit(p => ({...p, line: e.target.value}))} />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Name</span>
                      <input className={styles.input} value={edit.name ?? ""} onChange={(e) => setEdit(p => ({...p, name: e.target.value}))} />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Størrelse (g)</span>
                      <input className={styles.input} inputMode="numeric" value={edit.size_g ?? ""} onChange={(e) => setEdit(p => ({...p, size_g: e.target.value ? Number(e.target.value) : undefined}))} />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Form</span>
                      <select className={styles.select} value={edit.form ?? "beans"} onChange={(e) => setEdit(p => ({...p, form: e.target.value as any}))}>
                        <option value="beans">beans</option>
                        <option value="ground">ground</option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Organic</span>
                      <select
                        className={styles.select}
                        value={edit.organic === undefined ? "" : edit.organic ? "true" : "false"}
                        onChange={(e) => setEdit((p) => ({ ...p, organic: e.target.value === "" ? undefined : e.target.value === "true" }))}
                      >
                        <option value="">ukendt</option>
                        <option value="true">ja</option>
                        <option value="false">nej</option>
                      </select>
                    </label>
                  </div>

                  <div className={styles.actions}>
                    <button className={styles.btn} onClick={onSaveExtractedAndRetry} disabled={busy}>
                      {busy ? <><span className={styles.spin} />Arbejder...</> : "Gem & match igen"}
                    </button>

                    <button className={styles.btn} onClick={onCreateAsNewProduct} disabled={busy}>
                      {busy ? <><span className={styles.spin} />Opretter...</> : "Opret som nyt produkt"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}