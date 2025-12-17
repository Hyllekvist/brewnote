"use client";

import { useMemo, useState } from "react";
import styles from "./RateBrewPanel.module.css";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  sessionId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  onSaved?: () => void;
};

function clamp10(n: number) {
  return Math.max(1, Math.min(10, Math.round(n)));
}

export default function RateBrewPanel({ sessionId, productId, variantId, onSaved }: Props) {
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
    if (!variantId) return;

    setErr(null);
    setMsg(null);
    setBusy(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Du skal være logget ind for at rate.");

      const res = await fetch("/api/ratings/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId ?? null,
          productId: productId ?? null,
          variantId,
          bitterness: clamp10(bitterness),
          body: clamp10(body),
          clarity: clamp10(clarity),
          as_expected: asExpected,
          notes: notes.trim() || null,
        }),
      });

      const text = await res.text();
      let j: any = null;
      try { j = JSON.parse(text); } catch {}

      if (res.status === 401) throw new Error("Du skal være logget ind for at rate.");
      if (!res.ok) throw new Error(j?.error ?? text);

      setMsg("Tak — gemt ✅ (det gør BrewNote klogere)");
      onSaved?.();
    } catch (e: any) {
      setErr(e?.message ?? "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.wrap} aria-label="Rate brew">
      <div className={styles.head}>
        <div className={styles.badge}>V4 · Learning</div>
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
          >
            Ja
          </button>
          <button
            className={`${styles.chip} ${asExpected === false ? styles.chipOn : ""}`}
            onClick={() => setAsExpected(false)}
            type="button"
          >
            Nej
          </button>
          <button
            className={`${styles.chip} ${asExpected === null ? styles.chipOn : ""}`}
            onClick={() => setAsExpected(null)}
            type="button"
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
        <div className={styles.muted}>
          (Der er ingen variant endnu — scan/match først.)
        </div>
      ) : null}
    </section>
  );
}