"use client";

import { useMemo, useState } from "react";
import styles from "./RateBrewPanel.module.css";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type SavedRow = {
  id: string;
  variant_id: string;
  product_id: string | null;
  session_id: string | null;
  bitterness: number;
  body: number;
  clarity: number;
  as_expected: boolean | null;
  notes: string | null;
  created_at?: string;
};

type Props = {
  sessionId?: string | null;
  productId?: string | null;
  variantId?: string | null;

  // v5: giver ScanClient mulighed for at re-fetch variant details (dna/origin/brew)
  onSaved?: (row: SavedRow) => void;
};

function clamp10(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 6;
  return Math.max(1, Math.min(10, Math.round(x)));
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function RateBrewPanel({
  sessionId,
  productId,
  variantId,
  onSaved,
}: Props) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [bitterness, setBitterness] = useState(6);
  const [body, setBody] = useState(6);
  const [clarity, setClarity] = useState(6);
  const [asExpected, setAsExpected] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSave = !!variantId && !busy;

  async function onSubmit() {
    if (!variantId || busy) return;

    setErr(null);
    setMsg(null);
    setBusy(true);

    try {
      // kræv login
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr || !auth?.user) {
        throw new Error("Du skal være logget ind for at rate.");
      }

      const payload = {
        sessionId: sessionId ?? null,
        productId: productId ?? null,
        variantId,
        bitterness: clamp10(bitterness),
        body: clamp10(body),
        clarity: clamp10(clarity),
        as_expected: asExpected,
        notes: notes.trim() || null,
      };

      const res = await fetch("/api/ratings/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const j = safeJson(text);

      if (res.status === 401) throw new Error("Du skal være logget ind for at rate.");
      if (!res.ok) throw new Error(j?.error ?? text);

      const row = (j?.row ?? null) as SavedRow | null;

      setMsg("Tak — gemt ✅ (det gør BrewNote klogere)");
      setNotes("");

      // v5: trigger instant refresh i parent (ScanClient)
      if (row) onSaved?.(row);
      else onSaved?.({
        // fallback hvis api ikke returnerer row (men det burde den)
        id: "unknown",
        variant_id: variantId,
        product_id: productId ?? null,
        session_id: sessionId ?? null,
        bitterness: payload.bitterness,
        body: payload.body,
        clarity: payload.clarity,
        as_expected: payload.as_expected ?? null,
        notes: payload.notes,
      });
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.wrap} aria-label="Rate brew">
      <div className={styles.head}>
        <div className={styles.badge}>V5 · Learning</div>
        <div className={styles.title}>Rate this brew</div>
        <div className={styles.sub}>
          10 sekunder nu = bedre anbefalinger og mere præcis DNA senere.
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.slider}>
          <div className={styles.row}>
            <span>Bitterness</span>
            <b>{bitterness}/10</b>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={bitterness}
            onChange={(e) => setBitterness(Number(e.target.value))}
          />
          <div className={styles.hint}>Lav ← · → Høj</div>
        </div>

        <div className={styles.slider}>
          <div className={styles.row}>
            <span>Body</span>
            <b>{body}/10</b>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={body}
            onChange={(e) => setBody(Number(e.target.value))}
          />
          <div className={styles.hint}>Let ← · → Fyldig</div>
        </div>

        <div className={styles.slider}>
          <div className={styles.row}>
            <span>Clarity</span>
            <b>{clarity}/10</b>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={clarity}
            onChange={(e) => setClarity(Number(e.target.value))}
          />
          <div className={styles.hint}>Uklar ← · → Ren</div>
        </div>
      </div>

      <div className={styles.choiceRow}>
        <div className={styles.choiceLabel}>Som forventet?</div>
        <div className={styles.choiceBtns}>
          <button
            className={`${styles.chip} ${asExpected === true ? styles.chipOn : ""}`}
            onClick={() => setAsExpected(true)}
            type="button"
            disabled={busy}
          >
            Ja
          </button>
          <button
            className={`${styles.chip} ${asExpected === false ? styles.chipOn : ""}`}
            onClick={() => setAsExpected(false)}
            type="button"
            disabled={busy}
          >
            Nej
          </button>
          <button
            className={`${styles.chip} ${asExpected === null ? styles.chipOn : ""}`}
            onClick={() => setAsExpected(null)}
            type="button"
            disabled={busy}
          >
            Ved ikke
          </button>
        </div>
      </div>

      <label className={styles.notes}>
        <span>Noter (valgfri)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="fx: for bitter ved 94°C, bedre ved 92°C…"
          rows={3}
          disabled={busy}
        />
      </label>

      {(err || msg) && (
        <div className={styles.msg}>
          {err ? <div className={styles.err}>{err}</div> : null}
          {msg ? <div className={styles.ok}>{msg}</div> : null}
        </div>
      )}

      <button className={styles.primary} onClick={onSubmit} disabled={!canSave}>
        {busy ? "Gemmer…" : "Gem rating"}
      </button>

      {!variantId ? (
        <div className={styles.muted}>(Der er ingen variant endnu — scan/match først.)</div>
      ) : null}
    </section>
  );
}