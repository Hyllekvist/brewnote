import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Domain = "coffee" | "tea";
type Quick = "sour" | "balanced" | "bitter" | null;

type RateBody = {
  variant_id: string;
  domain: Domain;
  stars: number; // 1..5
  product_slug?: string;
  label?: string;
  quick?: Quick;
};

type TasteVec = {
  b: number; // bitterness
  a: number; // acidity
  s: number; // sweetness
  m: number; // mouthfeel/body
  r: number; // aroma intensity
  c: number; // clarity/clean finish
  t?: number; // astringency (tea only)
};

type TasteVecDB = Record<string, unknown>;

const EPS = 1e-6;

const AXES_CORE = ["b", "a", "s", "m", "r", "c"] as const;
const AXES_TEA = [...AXES_CORE, "t"] as const;

const WEIGHTS: Record<Domain, Record<string, number>> = {
  coffee: { b: 1.0, a: 1.0, s: 0.8, m: 1.0, r: 0.9, c: 0.7 },
  tea: { b: 0.9, a: 0.6, s: 0.6, m: 0.5, r: 1.1, c: 1.2, t: 1.1 },
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function sigmoid(z: number) {
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  } else {
    const ez = Math.exp(z);
    return ez / (1 + ez);
  }
}

function starsToY(stars: number) {
  return (stars - 1) / 4; // 1..5 -> 0..1
}

function axesFor(domain: Domain) {
  return domain === "tea" ? AXES_TEA : AXES_CORE;
}

function defaultP(domain: Domain): TasteVec {
  return domain === "coffee"
    ? { b: 0.55, a: 0.45, s: 0.35, m: 0.55, r: 0.6, c: 0.45 }
    : { b: 0.35, a: 0.35, s: 0.2, m: 0.25, r: 0.6, c: 0.75, t: 0.4 };
}

function initMu(domain: Domain): TasteVec {
  const base: TasteVec = { b: 0.5, a: 0.5, s: 0.4, m: 0.5, r: 0.5, c: 0.5 };
  if (domain === "tea") base.t = 0.5;
  return base;
}

function initSigma(domain: Domain): TasteVec {
  const base: TasteVec = { b: 0.35, a: 0.35, s: 0.35, m: 0.35, r: 0.35, c: 0.35 };
  if (domain === "tea") base.t = 0.35;
  return base;
}

function asNum(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeVec(domain: Domain, raw: TasteVecDB | null | undefined, fallback: TasteVec): TasteVec {
  if (!raw || typeof raw !== "object") return fallback;

  const v = raw as TasteVecDB;
  const out: TasteVec = {
    b: clamp01(asNum(v.b, fallback.b)),
    a: clamp01(asNum(v.a, fallback.a)),
    s: clamp01(asNum(v.s, fallback.s)),
    m: clamp01(asNum(v.m, fallback.m)),
    r: clamp01(asNum(v.r, fallback.r)),
    c: clamp01(asNum(v.c, fallback.c)),
  };

  if (domain === "tea") {
    out.t = clamp01(asNum(v.t, fallback.t ?? 0.5));
  }

  return out;
}

function computeDistance(domain: Domain, p: TasteVec, mu: TasteVec, sigma: TasteVec) {
  const w = WEIGHTS[domain];
  let D = 0;

  for (const k of axesFor(domain)) {
    const key = k as keyof TasteVec;

    const pi = clamp01(Number(p[key] ?? 0.5));
    const mui = clamp01(Number(mu[key] ?? 0.5));
    const si = Math.max(0.08, Number(sigma[key] ?? 0.35)); // floor
    const wi = Number(w[String(k)] ?? 1.0);

    const diff = pi - mui;
    D += wi * (diff * diff) / (si * si + EPS);
  }

  return D;
}

function updateProfile(params: {
  domain: Domain;
  stars: number;
  p: TasteVec;
  mu: TasteVec;
  sigma: TasteVec;
  beta: number;
}) {
  const { domain, stars, p, mu, sigma, beta } = params;
  const w = WEIGHTS[domain];

  const y = starsToY(stars);
  const D = computeDistance(domain, p, mu, sigma);
  const yHat = sigmoid(beta - D);

  const eta = 0.06;
  const lambda = 0.04;

  const nextMu: TasteVec = { ...mu };
  const nextSigma: TasteVec = { ...sigma };

  for (const k of axesFor(domain)) {
    const key = k as keyof TasteVec;

    const pi = clamp01(Number(p[key] ?? 0.5));
    const mui = clamp01(Number(mu[key] ?? 0.5));
    const si = Math.max(0.08, Number(sigma[key] ?? 0.35));
    const wi = Number(w[String(k)] ?? 1.0);

    const grad = (y - yHat) * wi * (pi - mui) / (si * si + EPS);
    nextMu[key] = clamp01(mui + eta * grad);

    const tighten = 1 - lambda * Math.abs(y - yHat);
    nextSigma[key] = Math.max(0.08, si * tighten);
  }

  const betaEta = 0.15;
  const nextBeta = beta + betaEta * (y - yHat);

  return { y, yHat, D, mu: nextMu, sigma: nextSigma, beta: nextBeta };
}

function bump01(x: number, d: number) {
  return clamp01(x + d);
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  // auth user
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user_id = auth.user.id;

  // body
  let body: RateBody;
  try {
    body = (await req.json()) as RateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const domain = body.domain;
  const stars = Number(body.stars);

  if (domain !== "coffee" && domain !== "tea") {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }
  if (!body.variant_id) {
    return NextResponse.json({ error: "Missing variant_id" }, { status: 400 });
  }
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "Stars must be 1..5" }, { status: 400 });
  }

  // 1) ensure we have a product vector p for this variant
  let p: TasteVec = defaultP(domain);

  const { data: vt, error: vtErr } = await supabase
    .from("variant_taste_vectors")
    .select("p, domain, product_slug, label")
    .eq("variant_id", body.variant_id)
    .maybeSingle();

  if (vtErr) {
    return NextResponse.json({ error: vtErr.message }, { status: 400 });
  }

  if (vt?.p && (vt.domain === domain || !vt.domain)) {
    p = sanitizeVec(domain, vt.p as TasteVecDB, defaultP(domain));

    // optional: update metadata if provided and missing
    if ((body.product_slug || body.label) && (!vt.product_slug || !vt.label)) {
      const { error: metaErr } = await supabase
        .from("variant_taste_vectors")
        .update({
          product_slug: body.product_slug ?? vt.product_slug ?? null,
          label: body.label ?? vt.label ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("variant_id", body.variant_id);

      if (metaErr) {
        return NextResponse.json({ error: metaErr.message }, { status: 400 });
      }
    }
  } else {
    // seed if missing
    const { error: seedErr } = await supabase.from("variant_taste_vectors").upsert(
      {
        variant_id: body.variant_id,
        domain,
        p,
        confidence: 0.2,
        product_slug: body.product_slug ?? null,
        label: body.label ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "variant_id" }
    );

    if (seedErr) {
      return NextResponse.json({ error: seedErr.message }, { status: 400 });
    }
  }

  // 2) write rating row
  const { error: insErr } = await supabase.from("taste_ratings").insert({
    user_id,
    variant_id: body.variant_id,
    domain,
    stars,
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  // 3) load user profile and update
  const { data: prof, error: profErr } = await supabase
    .from("user_domain_profiles")
    .select("mu, sigma, beta")
    .eq("user_id", user_id)
    .eq("domain", domain)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 400 });
  }

  const mu: TasteVec = prof?.mu
    ? sanitizeVec(domain, prof.mu as TasteVecDB, initMu(domain))
    : initMu(domain);

  const sigma: TasteVec = prof?.sigma
    ? sanitizeVec(domain, prof.sigma as TasteVecDB, initSigma(domain))
    : initSigma(domain);

  const beta = Number(prof?.beta ?? 0.0);

  const updated = updateProfile({ domain, stars, p, mu, sigma, beta });

  // 4) apply quick feedback nudges (small + controlled)
  const quick: Quick = (body.quick ?? null) as Quick;

  if (quick === "sour") {
    // "for sur" -> prefer lower acidity
    updated.mu.a = bump01(updated.mu.a ?? 0.5, -0.03);
    updated.sigma.a = Math.max(0.10, (updated.sigma.a ?? 0.35) * 0.97);
  } else if (quick === "bitter") {
    // "for bitter" -> prefer lower bitterness
    updated.mu.b = bump01(updated.mu.b ?? 0.5, -0.03);
    updated.sigma.b = Math.max(0.10, (updated.sigma.b ?? 0.35) * 0.97);
  } else if (quick === "balanced") {
    // "perfekt" -> increase confidence slightly across axes
    const keys = domain === "tea"
      ? (["b", "a", "s", "m", "r", "c", "t"] as const)
      : (["b", "a", "s", "m", "r", "c"] as const);

    for (const k of keys) {
      const key = k as keyof TasteVec;
      // sigma exists on same keys as TasteVec
      // @ts-expect-error (fine: TasteVec aligns)
      updated.sigma[key] = Math.max(0.10, (updated.sigma[key] ?? 0.35) * 0.98);
    }
  }

  const { error: upErr } = await supabase.from("user_domain_profiles").upsert(
    {
      user_id,
      domain,
      mu: updated.mu,
      sigma: updated.sigma,
      beta: updated.beta,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,domain" }
  );

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    debug: { y: updated.y, yHat: updated.yHat, D: updated.D },
  });
}