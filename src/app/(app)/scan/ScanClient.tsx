"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import BrewmasterPanel from "./BrewmasterPanel";
import RateBrewPanel from "./RateBrewPanel";
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

type Suggestion = { variant_id: string; label: string; confidence: number };

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

type Stage = "idle" | "ready" | "scanning" | "done";

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stableStringify(v: any) {
  try {
    if (v == null) return "";
    const keys = Object.keys(v).sort();
    return JSON.stringify(v, keys);
  } catch {
    return String(v);
  }
}

function fingerprintDetail(d: VariantDetail | null) {
  if (!d) return "";
  return [stableStringify(d.origin), stableStringify(d.dna), stableStringify(d.brew)].join("|");
}

export default function ScanClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
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

  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  function onPickFile(f: File | null) {
    setErr(null);
    setSavedMsg(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);

    setFile(f);
    setStage(f ? "ready" : "idle");

    setResult(null);
    setDetail(null);
    setEditOpen(false);
  }

  function clearResultKeepFile() {
    setErr(null);
    setSavedMsg(null);
    setResult(null);
    setDetail(null);
    setEditOpen(false);
    setStage(file ? "ready" : "idle");
    // scroll lidt op så man ser scan-card igen
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onScan() {
    setErr(null);
    setSavedMsg(null);
    setDetail(null);
    if (!file) return;
  // ✅ kræv login før vi uploader/scanner
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    window.location.href = `/login?next=${encodeURIComponent("/scan")}`;
    return;
  }

    setBusy(true);
    setStage("scanning");

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

      const { error: upErr } = await supabase.storage.from("scans").upload(uploadPath, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const procRes = await fetch("/api/scan/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const text = await procRes.text();
      const j = safeJson(text);
      if (!procRes.ok) throw new Error(`process ${procRes.status}: ${j?.error ?? text}`);

      const data = j as ProcessResult;
      setResult(data);
      loadEditFromResult(data);
      setEditOpen(false);

      if (data.status === "resolved" && data.match?.variant_id) {
        await loadDetails(data.match.variant_id);
      } else {
        setDetail(null);
      }

      setStage("done");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
      setStage(file ? "ready" : "idle");
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

      const data = j as ProcessResult;
      setResult(data);
      loadEditFromResult(data);

      if (data.status === "resolved" && data.match?.variant_id) await loadDetails(data.match.variant_id);
      else setDetail(null);

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
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

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
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

async function onConfirmSuggestion(variantId: string) {
  if (!result?.sessionId) return;

  setErr(null);
  setSavedMsg(null);
  setBusy(true);

  try {
    const res = await fetch("/api/scan/confirm-variant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: result.sessionId, variantId }),
    });

    const text = await res.text();
    const j = safeJson(text);
    if (res.status === 401) throw new Error("Du skal være logget ind.");
    if (!res.ok) throw new Error(j?.error ?? text);

    // opdater result lokalt → resolved
    setResult((prev) =>
      prev
        ? {
            ...prev,
            status: "resolved",
            confidence: j?.confidence ?? 0.95,
            match: prev.match ?? null, // bliver sat korrekt når vi re-run process eller når detail loader
            suggestions: [],
          }
        : prev
    );

    // hent details (også så BrewmasterPanel + rating får det rigtige)
    await loadDetails(variantId);

    // og opdater match i UI så alt er konsistent
    setResult((prev) =>
      prev
        ? {
            ...prev,
            status: "resolved",
            confidence: j?.confidence ?? prev.confidence,
            match: prev.match
              ? { ...prev.match, variant_id: variantId }
              : { product_id: "", variant_id: variantId, brand: "", name: "" },
            suggestions: [],
          }
        : prev
    );

    setSavedMsg("Valgt ✓ (BrewNote lærer af det)");
    setEditOpen(false);

    setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      120
    );
  } catch (e: any) {
    setErr(e?.message ?? "Noget gik galt");
  } finally {
    setBusy(false);
  }
}

  // ✅ V8: ægte feedback efter rating + instant refresh uden “fake” update
  async function onRatingSaved() {
    const vid = detail?.variant?.id || result?.match?.variant_id;
    if (!vid) {
      setSavedMsg("Tak — gemt ✅");
      return;
    }

    const before = fingerprintDetail(detail);

    try {
      // hent én gang og sammenlign
      const res = await fetch(`/api/products/variant/${vid}`, { method: "GET" });
      const text = await res.text();
      const j = safeJson(text);
      if (!res.ok) {
        setSavedMsg("Tak — gemt ✅");
        return;
      }

      const after = fingerprintDetail(j as VariantDetail);

      // opdater UI med de nyeste data
      setDetail(j as VariantDetail);

      if (after && after !== before) {
        setSavedMsg("BrewNote opdateret ✓ (din feedback hjælper)");
      } else {
        setSavedMsg("Tak — gemt ✅ (din feedback hjælper)");
      }
    } catch {
      setSavedMsg("Tak — gemt ✅ (din feedback hjælper)");
    }
  }

  const confidence = result?.confidence ?? 0;
  const canSaveInventory =
    result?.status === "resolved" && (detail?.variant?.id || result?.match?.variant_id);

  const missing: string[] = [];
  if (result && !detail?.origin) missing.push("origin");
  if (result && !detail?.dna) missing.push("smags-DNA");
  const missingText = missing.length
    ? `Mangler: ${missing.join(" + ")} (bliver bedre, når flere scanner/bedømmer).`
    : null;

  // ✅ V7.1: sticky Scan må IKKE ligge ovenpå resultater/rating
  const showSticky = stage !== "idle" && !!file && stage !== "done";

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.scanCard} ${busy ? styles.scanning : ""}`}>
        <div className={styles.scanTop}>
          <div className={styles.scanBadge}>{stage === "done" ? "Klar" : "AI Scan"}</div>
          <div className={styles.scanTitle}>
            {stage === "done" ? "Scan klar" : "Peg kameraet mod posen"}
          </div>
          <div className={styles.scanHint}>
            {stage === "done"
              ? "Se resultatet nedenfor — eller scan en ny pose."
              : "Godt lys. Skarp front. Ingen glare."}
          </div>
        </div>

        <div className={styles.scanFrame}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview" className={styles.previewImg} />
          ) : (
            <div className={styles.frameIcon} aria-hidden="true">
              ⌁
            </div>
          )}
          {busy && <div className={styles.scanSweep} aria-hidden="true" />}
        </div>

        <div className={styles.controls}>
          <label className={styles.fileBtn}>
            {file ? "Skift billede" : "Vælg billede"}
            <input
              className={styles.fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className={styles.fileMeta}>
            <div className={styles.fileName}>{file ? file.name : "Ingen fil valgt"}</div>
            <div className={styles.fileSub}>JPG/PNG · Mobilkamera anbefales</div>
          </div>
        </div>

        <div className={styles.scanActions}>
          <button className={styles.primaryBtn} onClick={onScan} disabled={!file || busy}>
            {busy ? "Scanner…" : stage === "done" ? "Scan igen" : "Scan"}
          </button>

          {stage === "done" && (
            <button className={styles.tertiaryBtn} onClick={clearResultKeepFile} type="button">
              Ryd resultat
            </button>
          )}
        </div>
      </section>

      {(err || savedMsg) && (
        <div className={styles.noticeWrap}>
          {err && <div className={styles.noticeError}>{err}</div>}
          {savedMsg && <div className={styles.noticeOk}>{savedMsg}</div>}
        </div>
      )}

      {result && (
        <div ref={resultRef} className={styles.results}>
          <BrewmasterPanel
            confidence={confidence}
            match={result.match ?? null}
            brew={detail?.brew ?? null}
            origin={detail?.origin ?? null}
            dna={detail?.dna ?? null}
            missingText={missingText}
          />

{result.status === "needs_user" && (result.suggestions?.length ?? 0) > 0 && (
  <section className={styles.card} style={{ padding: 16 }}>
    <div style={{ fontWeight: 850, marginBottom: 8 }}>Vælg den rigtige</div>
    <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 12 }}>
      Jeg er ikke sikker — vælg én, så bliver den fremover nemmere at genkende.
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {result.suggestions!.map((s) => (
        <button
          key={s.variant_id || s.label}
          className={styles.secondaryBtn}
          onClick={() => onConfirmSuggestion(s.variant_id)}
          disabled={busy || !s.variant_id}
          style={{ justifyContent: "space-between", display: "flex" }}
        >
          <span>{s.label}</span>
          <span style={{ opacity: 0.7, fontWeight: 800 }}>
            {Math.round((s.confidence ?? 0.55) * 100)}%
          </span>
        </button>
      ))}
    </div>
  </section>
)}

{result.status === "resolved" && (detail?.variant?.id || result.match?.variant_id) && (
  <RateBrewPanel
    sessionId={result.sessionId}
    productId={result.match?.product_id ?? null}
    variantId={result.match?.variant_id ?? null}
    onSaved={onRatingSaved}
  />
)}

       {result.status === "resolved" && (
  <section className={styles.card}>
    <button
      className={styles.secondaryBtn}
      onClick={onSaveToInventory}
      disabled={busy || !canSaveInventory}
    >
      {busy ? "Gemmer…" : "Gem i inventory"}
    </button>
  </section>
)}

          <section className={styles.card}>
            <button className={styles.accordionHeader} onClick={() => setEditOpen((v) => !v)}>
              <span>Ret info</span>
              <span className={styles.chev}>{editOpen ? "▴" : "▾"}</span>
            </button>

            {editOpen && (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Brand</span>
                  <input
                    value={edit.brand ?? ""}
                    onChange={(e) => setEdit((p) => ({ ...p, brand: e.target.value }))}
                  />
                </label>

                <label className={styles.field}>
                  <span>Line</span>
                  <input
                    value={edit.line ?? ""}
                    onChange={(e) => setEdit((p) => ({ ...p, line: e.target.value }))}
                  />
                </label>

                <label className={styles.field}>
                  <span>Name</span>
                  <input
                    value={edit.name ?? ""}
                    onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>

                <label className={styles.field}>
                  <span>Størrelse (g)</span>
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

                <label className={styles.field}>
                  <span>Form</span>
                  <select
                    value={edit.form ?? "beans"}
                    onChange={(e) => setEdit((p) => ({ ...p, form: e.target.value as any }))}
                  >
                    <option value="beans">beans</option>
                    <option value="ground">ground</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Organic</span>
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

                <div className={styles.actionsRow}>
                  <button
                    className={styles.secondaryBtn}
                    onClick={onSaveExtractedAndRetry}
                    disabled={busy || !result?.sessionId}
                  >
                    {busy ? "Arbejder…" : "Gem & match igen"}
                  </button>
                  <button
                    className={styles.ghostBtn}
                    onClick={onCreateAsNewProduct}
                    disabled={busy || !result?.sessionId}
                  >
                    {busy ? "Opretter…" : "Opret som nyt produkt"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {showSticky && (
        <div className={styles.sticky}>
          <button className={styles.stickyBtn} onClick={onScan} disabled={!file || busy}>
            {busy ? "Scanner…" : "Scan"}
          </button>
        </div>
      )}
    </div>
  );
}