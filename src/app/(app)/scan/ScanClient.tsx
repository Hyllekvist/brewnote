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
  variant: { id: string; product_id: string; size_g?: number | null; form?: string | null; intensity?: number | null; arabica_pct?: number | null; organic?: boolean | null };
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
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [edit, setEdit] = useState<Extracted>({
    brand: "",
    line: "",
    name: "",
    size_g: undefined,
    form: "beans",
    organic: undefined,
    ean: "",
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

  async function onScan() {
    setErr(null);
    setSavedMsg(null);
    setResult(null);
    setDetail(null);
    if (!file) return;

    setBusy(true);
    try {
      const startRes = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "image/jpeg" }),
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

      setEditOpen(false);
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

      const text = await procRes.text();
      const j = safeJson(text);
      if (!procRes.ok) throw new Error(`process ${procRes.status}: ${j?.error ?? text}`);

      const data: ProcessResult = j as ProcessResult;
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

      if (j?.match?.variant_id) await loadDetails(j.match.variant_id);
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

    setErr(null);
    setSavedMsg(null);
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
      if (!res.ok) throw new Error(`inventory ${res.status}: ${j?.error ?? text}`);

      setSavedMsg("Gemt i inventory ✓");
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  const confidence = result?.confidence ?? 0;
  const isResolved = result?.status === "resolved";
  const canSaveInventory = isResolved && (detail?.variant?.id || result?.match?.variant_id);

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.brandDot} />
        <div className={styles.brandTitle}>Coffee & Tea</div>
        <div className={styles.topbarRight}>
          <button className={styles.iconBtn} aria-label="Theme">
            ☾
          </button>
        </div>
      </div>

      <div className={styles.header}>
        <h1 className={styles.h1}>Scan kaffe/te</h1>
        <p className={styles.sub}>Scan posen → match produkt → gem</p>
      </div>

      <div className={styles.card}>
        <div className={styles.scanArea}>
          <div className={styles.scanIcon}>⌁</div>
          <div className={styles.scanTitle}>Scan posen</div>
          <div className={styles.scanHint}>Peg kameraet mod forsiden. Godt lys. Ingen blur.</div>

          <div className={styles.fileRow}>
            <label className={styles.fileBtn}>
              Vælg billede
              <input
                className={styles.fileInput}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className={styles.fileName}>{file ? file.name : "Ingen fil valgt"}</div>
          </div>

          <button className={styles.primaryBtn} onClick={onScan} disabled={!file || busy}>
            {busy ? "Scanner…" : "Scan"}
          </button>
        </div>
      </div>

      {(err || savedMsg) && (
        <div className={styles.noticeWrap}>
          {err && <div className={styles.noticeError}>{err}</div>}
          {savedMsg && <div className={styles.noticeOk}>{savedMsg}</div>}
        </div>
      )}

      {result && (
        <>
          <div className={styles.pillsRow}>
            <div className={styles.pillStrong}>
              Scan færdig · {pct(confidence)}
            </div>
            <div className={styles.pillSoft}>
              {result.status === "resolved" ? "Resolved" : result.status === "needs_user" ? "Needs input" : "Failed"} · {pct(confidence)}
            </div>
          </div>

          {result.match && (
            <div className={styles.card}>
              <div className={styles.productTitle}>
                {result.match.brand} {result.match.line ? `${result.match.line} ` : ""}{result.match.name}
              </div>

              <div className={styles.metaGrid}>
                {result.match.size_g != null && <div className={styles.metaItem}><span>Størrelse</span><b>{result.match.size_g}g</b></div>}
                {result.match.form && <div className={styles.metaItem}><span>Form</span><b>{result.match.form}</b></div>}
                {result.match.intensity != null && <div className={styles.metaItem}><span>Intensitet</span><b>{result.match.intensity}/10</b></div>}
                {result.match.arabica_pct != null && <div className={styles.metaItem}><span>Arabica</span><b>{result.match.arabica_pct}%</b></div>}
                {result.match.organic != null && <div className={styles.metaItem}><span>Organic</span><b>{result.match.organic ? "Ja" : "Nej"}</b></div>}
              </div>
            </div>
          )}

          {detail && (
            <div className={styles.card}>
              <div className={styles.sectionTitle}>Produkt-info</div>

              <div className={styles.infoRow}>
                <div className={styles.infoLabel}>Origin</div>
                <div className={styles.infoValue}>{detail.origin ? JSON.stringify(detail.origin) : "— (ingen origin endnu)"}</div>
              </div>

              <div className={styles.infoRow}>
                <div className={styles.infoLabel}>DNA</div>
                <div className={styles.infoValue}>{detail.dna ? JSON.stringify(detail.dna) : "— (ingen dna endnu)"}</div>
              </div>

              <div className={styles.infoRow}>
                <div className={styles.infoLabel}>Anbefalet bryg</div>
                <div className={styles.infoValue}>
                  <b>{detail.brew.method}</b> · Grind: {detail.brew.grind} · Ratio: {detail.brew.ratio} · Temp: {detail.brew.temp_c}°C
                  {detail.brew.notes ? <div className={styles.infoNote}>{detail.brew.notes}</div> : null}
                </div>
              </div>

              <button className={styles.secondaryBtn} onClick={onSaveToInventory} disabled={busy || !canSaveInventory}>
                {busy ? "Gemmer…" : "Gem i inventory"}
              </button>
            </div>
          )}

          <div className={styles.card}>
            <button className={styles.accordionHeader} onClick={() => setEditOpen((v) => !v)}>
              <span>Ret info (MVP)</span>
              <span className={styles.chev}>{editOpen ? "▴" : "▾"}</span>
            </button>

            {editOpen && (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Brand</span>
                  <input value={edit.brand ?? ""} onChange={(e) => setEdit((p) => ({ ...p, brand: e.target.value }))} />
                </label>

                <label className={styles.field}>
                  <span>Line</span>
                  <input value={edit.line ?? ""} onChange={(e) => setEdit((p) => ({ ...p, line: e.target.value }))} />
                </label>

                <label className={styles.field}>
                  <span>Name</span>
                  <input value={edit.name ?? ""} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} />
                </label>

                <label className={styles.field}>
                  <span>Størrelse (g)</span>
                  <input
                    inputMode="numeric"
                    value={edit.size_g ?? ""}
                    onChange={(e) => setEdit((p) => ({ ...p, size_g: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </label>

                <label className={styles.field}>
                  <span>Form</span>
                  <select value={edit.form ?? "beans"} onChange={(e) => setEdit((p) => ({ ...p, form: e.target.value as any }))}>
                    <option value="beans">beans</option>
                    <option value="ground">ground</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Organic</span>
                  <select
                    value={edit.organic === undefined ? "" : edit.organic ? "true" : "false"}
                    onChange={(e) => setEdit((p) => ({ ...p, organic: e.target.value === "" ? undefined : e.target.value === "true" }))}
                  >
                    <option value="">ukendt</option>
                    <option value="true">ja</option>
                    <option value="false">nej</option>
                  </select>
                </label>

                <div className={styles.actionsRow}>
                  <button className={styles.secondaryBtn} onClick={onSaveExtractedAndRetry} disabled={busy || !result?.sessionId}>
                    {busy ? "Arbejder…" : "Gem & match igen"}
                  </button>
                  <button className={styles.ghostBtn} onClick={onCreateAsNewProduct} disabled={busy || !result?.sessionId}>
                    {busy ? "Opretter…" : "Opret som nyt produkt"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Sticky action (mobile) */}
      <div className={styles.sticky}>
        <button className={styles.stickyBtn} onClick={onScan} disabled={!file || busy}>
          {busy ? "Scanner…" : "Scan"}
        </button>
      </div>
    </div>
  );
}