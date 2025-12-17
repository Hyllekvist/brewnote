"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const pct = (n: number) => `${Math.round((n ?? 0) * 100)}%`;

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

  // revoke previous previewUrl on change/unmount
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

    // reset scan output
    setResult(null);
    setDetail(null);
    setEditOpen(false);
  }

  async function onScan() {
    setErr(null);
    setSavedMsg(null);
    setDetail(null);
    if (!file) return;

    setBusy(true);
    setStage("scanning");

    try {
      // 1) start scan session
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

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 140);
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

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 140);
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

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 140);
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

  const showSticky = stage !== "idle" && !!file;
  const stickyLabel = stage === "scanning" ? "Scanner…" : "Scan";
  const stickyDisabled = !file || busy;

  const bm = useMemo(() => {
    const m = result?.match;
    const brew = detail?.brew;

    const tips: string[] = [];

    if (m?.intensity != null) {
      if (m.intensity >= 8)
        tips.push("Høj intensitet → hvis den bliver harsh: grovere grind eller 1–2°C lavere vandtemp.");
      else if (m.intensity <= 4)
        tips.push("Lav intensitet → hvis du savner punch: lidt finere grind eller højere dose.");
      else tips.push("Mellem intensitet → små grind-justeringer er din bedste kontrolknap.");
    }

    if (m?.arabica_pct != null) {
      if (m.arabica_pct >= 90) tips.push("Høj Arabica → ofte mere aroma/sødme og mindre ‘kant’.");
      else tips.push("Mere blend/robusta → typisk mere bite/crema og hårdere koffein-følelse.");
    }

    if (m?.form === "beans") tips.push("Hele bønner: kværn lige før bryg for markant bedre aroma.");
    if (m?.form === "ground") tips.push("Formalet: opbevar lufttæt og mørkt — smagen falder hurtigere efter åbning.");

    const brewLine = brew?.method
      ? `${brew.method} · Grind: ${brew.grind} · Ratio: ${brew.ratio} · Temp: ${brew.temp_c}°C`
      : null;

    const missing: string[] = [];
    if (!detail?.origin) missing.push("origin");
    if (!detail?.dna) missing.push("smags-DNA");
    const missingText = missing.length
      ? `Mangler: ${missing.join(" + ")} (vi lærer det over tid når flere scanner/bedømmer).`
      : null;

    return { tips, brewLine, missingText };
  }, [result, detail]);

  return (
    <div className={styles.page}>
      {/* Scan card */}
      <section className={`${styles.card} ${styles.scanCard} ${busy ? styles.scanning : ""}`}>
        <div className={styles.scanTop}>
          <div className={styles.scanBadge}>{stage === "done" ? "Klar" : "AI Scan"}</div>
          <div className={styles.scanTitle}>
            {stage === "done" ? "Billede valgt" : "Peg kameraet mod posen"}
          </div>
          <div className={styles.scanHint}>
            {stage === "done" ? "Se resultat nedenfor — eller scan igen." : "Godt lys. Skarp front. Ingen glare."}
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

        <button className={styles.primaryBtn} onClick={onScan} disabled={!file || busy}>
          {busy ? "Scanner…" : "Scan"}
        </button>
      </section>

      {(err || savedMsg) && (
        <div className={styles.noticeWrap}>
          {err && <div className={styles.noticeError}>{err}</div>}
          {savedMsg && <div className={styles.noticeOk}>{savedMsg}</div>}
        </div>
      )}

      {result && (
        <div ref={resultRef} className={styles.resultsWrap}>
          <div className={styles.pillsRow}>
            <div className={styles.pillStrong}>Scan · {pct(confidence)}</div>
            <div className={styles.pillSoft}>
              {result.status === "resolved"
                ? "Match fundet"
                : result.status === "needs_user"
                ? "Kræver input"
                : "Fejlede"}{" "}
              · {pct(confidence)}
            </div>
          </div>

          {/* Card 1: What it is */}
          <section className={styles.card}>
            <div className={styles.sectionKicker}>What it is</div>

            {result.match ? (
              <>
                <div className={styles.productTitle}>
                  {result.match.brand} {result.match.line ? `${result.match.line} ` : ""}
                  {result.match.name}
                </div>

                <div className={styles.metaGrid}>
                  {result.match.size_g != null && (
                    <div className={styles.metaItem}>
                      <span>Størrelse</span>
                      <b>{result.match.size_g}g</b>
                    </div>
                  )}
                  {result.match.form && (
                    <div className={styles.metaItem}>
                      <span>Form</span>
                      <b>{result.match.form}</b>
                    </div>
                  )}
                  {result.match.intensity != null && (
                    <div className={styles.metaItem}>
                      <span>Intensitet</span>
                      <b>{result.match.intensity}/10</b>
                    </div>
                  )}
                  {result.match.arabica_pct != null && (
                    <div className={styles.metaItem}>
                      <span>Arabica</span>
                      <b>{result.match.arabica_pct}%</b>
                    </div>
                  )}
                  {result.match.organic != null && (
                    <div className={styles.metaItem}>
                      <span>Organic</span>
                      <b>{result.match.organic ? "Ja" : "Nej"}</b>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.emptyTitle}>Ingen sikker match endnu</div>
                <div className={styles.emptyText}>
                  Ret info nedenfor og prøv igen — eller opret som nyt produkt.
                </div>

                {(result.suggestions ?? []).length > 0 ? (
                  <div className={styles.suggestions}>
                    <div className={styles.suggestionsTitle}>Mulige forslag</div>
                    <ul className={styles.suggestionsList}>
                      {(result.suggestions ?? []).slice(0, 6).map((s) => (
                        <li key={s.variant_id || s.label} className={styles.suggestionItem}>
                          <span>{s.label}</span>
                          <span className={styles.suggestionPct}>{Math.round(s.confidence * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {/* Card 2: How to brew */}
          <section className={styles.card}>
            <div className={styles.sectionKicker}>How to brew</div>

            {detail?.brew ? (
              <>
                <div className={styles.brewLine}>
                  <b>{detail.brew.method}</b>
                  <span className={styles.brewDot}>·</span> Grind: {detail.brew.grind}
                  <span className={styles.brewDot}>·</span> Ratio: {detail.brew.ratio}
                  <span className={styles.brewDot}>·</span> Temp: {detail.brew.temp_c}°C
                </div>
                {detail.brew.notes ? <div className={styles.brewNotes}>{detail.brew.notes}</div> : null}
              </>
            ) : (
              <div className={styles.emptyText}>Ingen bryg-anbefaling endnu for denne variant.</div>
            )}

            {bm.tips.length ? (
              <ul className={styles.tips}>
                {bm.tips.slice(0, 3).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
          </section>

          {/* Card 3: Insights */}
          <section className={styles.card}>
            <div className={styles.sectionKicker}>Insights</div>

            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>Origin</div>
              <div className={styles.infoValue}>
                {detail?.origin ? JSON.stringify(detail.origin) : "— (ikke sat endnu)"}
              </div>
            </div>

            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>Smags-DNA</div>
              <div className={styles.infoValue}>
                {detail?.dna ? JSON.stringify(detail.dna) : "— (ikke sat endnu)"}
              </div>
            </div>

            {bm.missingText ? <div className={styles.missing}>{bm.missingText}</div> : null}

            <div className={styles.actionsStack}>
              <button className={styles.secondaryBtn} onClick={onSaveToInventory} disabled={busy || !canSaveInventory}>
                {busy ? "Gemmer…" : "Gem i inventory"}
              </button>
            </div>
          </section>

          {/* Edit / correction */}
          <section className={styles.card}>
            <button className={styles.accordionHeader} onClick={() => setEditOpen((v) => !v)}>
              <span>Ret info</span>
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
                  <select value={edit.form ?? "beans"} onChange={(e) => setEdit((p) => ({ ...p, form: e.target.value as any }))}>
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
                  <button className={styles.secondaryBtn} onClick={onSaveExtractedAndRetry} disabled={busy || !result?.sessionId}>
                    {busy ? "Arbejder…" : "Gem & match igen"}
                  </button>
                  <button className={styles.ghostBtn} onClick={onCreateAsNewProduct} disabled={busy || !result?.sessionId}>
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
          <button className={styles.stickyBtn} onClick={onScan} disabled={stickyDisabled}>
            {stickyLabel}
          </button>
        </div>
      )}
    </div>
  );
}