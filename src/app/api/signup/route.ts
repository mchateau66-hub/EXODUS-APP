// src/app/api/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { createSessionResponseForUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { err } from "@/lib/api-response";
import { limitSeconds, rateHeaders, rateKeyFromRequest } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SignupRole = "athlete" | "coach";
type SignupPlan = "free" | "premium";
type BillingPeriod = "monthly" | "yearly";

const PREMIUM_PLAN_KEYS = {
  athlete: "athlete_premium",
  coach: "coach_premium",
} as const;

type PlanKey = (typeof PREMIUM_PLAN_KEYS)[keyof typeof PREMIUM_PLAN_KEYS];

type SignupBody = {
  role?: unknown;
  plan?: unknown;
  billingPeriod?: unknown;
  email?: unknown;
  name?: unknown;
  password?: unknown;
  // optionnel si tu veux lier des events analytics au checkout
  analytics_session_id?: unknown;
};

function noStoreJson(data: unknown, init?: { status?: number; headers?: Headers }) {
  const h = init?.headers ?? new Headers();
  h.set("cache-control", "no-store");
  return NextResponse.json(data, { status: init?.status ?? 200, headers: h });
}

function isSignupRole(v: unknown): v is SignupRole {
  return v === "athlete" || v === "coach";
}
function isSignupPlan(v: unknown): v is SignupPlan {
  return v === "free" || v === "premium";
}
function isBillingPeriod(v: unknown): v is BillingPeriod {
  return v === "monthly" || v === "yearly";
}

function nonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function normalizeEmail(v: unknown): string {
  return (typeof v === "string" ? v : "").trim().toLowerCase();
}

function clampName(v: unknown): string | null {
  const s = nonEmptyString(v);
  if (!s) return null;
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? clean.slice(0, 80) : clean;
}

function validatePassword(pw: string): { ok: true } | { ok: false; code: string } {
  if (!pw) return { ok: false, code: "password_required" };
  if (pw.length < 8) return { ok: false, code: "weak_password" };
  if (pw.length > 200) return { ok: false, code: "password_too_long" };
  return { ok: true };
}

function getBaseUrl(req: NextRequest): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (env) return env.replace(/\/+$/, "");
  return req.nextUrl.origin;
}

function getPriceIdFromEnv(planKey: PlanKey, billing: BillingPeriod): string | null {
  // Tu peux compléter yearly si tu as les variables
  if (planKey === "athlete_premium" && billing === "monthly") {
    return process.env.STRIPE_PRICE_ATHLETE_PREMIUM_MONTHLY ?? null;
  }
  if (planKey === "coach_premium" && billing === "monthly") {
    return process.env.STRIPE_PRICE_COACH_PREMIUM_MONTHLY ?? null;
  }
  if (planKey === "athlete_premium" && billing === "yearly") {
    return process.env.STRIPE_PRICE_ATHLETE_PREMIUM_YEARLY ?? null;
  }
  if (planKey === "coach_premium" && billing === "yearly") {
    return process.env.STRIPE_PRICE_COACH_PREMIUM_YEARLY ?? null;
  }
  return null;
}

function isProdLike() {
  // Vercel preview est aussi sensible → traite comme “prod-like”
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

/**
 * Anti-enumeration en prod-like :
 * - au lieu de "email_already_used", on renvoie une erreur générique.
 */
function maybeHideEmailConflict() {
  return isProdLike();
}

async function parseJsonBody(req: NextRequest): Promise<SignupBody | null> {
  // Guard taille (évite payload abuse)
  const cl = req.headers.get("content-length");
  if (cl) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > 8_000) return null; // 8KB max (largement suffisant)
  }

  try {
    const raw = (await req.json()) as unknown;
    if (!raw || typeof raw !== "object") return null;
    return raw as SignupBody;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // ✅ Rate limit (par IP / proxy)
  const rateKey = rateKeyFromRequest(req);
  const rl = await limitSeconds("signup", rateKey, 8, 60); // 8 req / minute / ip
  const rlHeaders = rateHeaders(rl);

  if (!rl.ok) {
    return noStoreJson(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: rlHeaders },
    );
  }

  const body = await parseJsonBody(req);
  if (!body) return noStoreJson({ ok: false, error: "invalid_body" }, { status: 400, headers: rlHeaders });

  const roleRaw = body.role;
  const planRaw = body.plan;

  if (!isSignupRole(roleRaw)) return noStoreJson({ ok: false, error: "unsupported_role" }, { status: 400, headers: rlHeaders });
  if (!isSignupPlan(planRaw)) return noStoreJson({ ok: false, error: "unsupported_plan" }, { status: 400, headers: rlHeaders });

  const role: SignupRole = roleRaw;
  const plan: SignupPlan = planRaw;

  const billingPeriod: BillingPeriod = isBillingPeriod(body.billingPeriod) ? body.billingPeriod : "monthly";

  const email = normalizeEmail(body.email);
  if (!email || email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return noStoreJson({ ok: false, error: "email_invalid" }, { status: 400, headers: rlHeaders });
  }

  const name = clampName(body.name);
  const password = typeof body.password === "string" ? body.password : "";
  const pwOk = validatePassword(password);
  if (!pwOk.ok) return noStoreJson({ ok: false, error: pwOk.code }, { status: pwOk.code === "weak_password" ? 422 : 400, headers: rlHeaders });

  const analyticsSessionId = nonEmptyString(body.analytics_session_id);

  try {
    // 1) check email exist (anti-enumeration en prod)
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      if (maybeHideEmailConflict()) {
        // réponse générique (pas d’info si le mail existe)
        return noStoreJson({ ok: false, error: "signup_failed" }, { status: 400, headers: rlHeaders });
      }
      return err("email_already_used", 409); // dev: utile
    }

    // 2) create user
    const user = await prisma.user.create({
      data: {
        email,
        role,
        ...(name ? { name } : {}),
        passwordHash: hashPassword(password),
        onboardingStep: 0,
      },
      select: { id: true, email: true, role: true },
    });

    // 3) FREE → session direct
    if (plan === "free") {
      // NB: je passe req pour que la lib auth puisse set cookies secure correctement
      const res = await createSessionResponseForUser(user.id, { ok: true, redirectTo: "/hub" }, req);
      // no-store + RateLimit headers
      res.headers.set("cache-control", "no-store");
      for (const [k, v] of rlHeaders.entries()) res.headers.set(k, v);
      return res;
    }

    // 4) PREMIUM → Stripe Checkout (pas d'auto-login avant paiement)
    const planKey: PlanKey = role === "athlete" ? PREMIUM_PLAN_KEYS.athlete : PREMIUM_PLAN_KEYS.coach;

    const planRow = await prisma.plan.findUnique({
      where: { key: planKey },
      select: { stripe_price_id_monthly: true, stripe_price_id_yearly: true },
    });

    let priceId: string | null =
      planRow
        ? billingPeriod === "monthly"
          ? planRow.stripe_price_id_monthly
          : planRow.stripe_price_id_yearly
        : null;

    if (!priceId) priceId = getPriceIdFromEnv(planKey, billingPeriod);

    if (!priceId) {
      console.error("[signup] Stripe price id missing", { planKey, billingPeriod });
      return noStoreJson({ ok: false, error: "price_not_configured" }, { status: 500, headers: rlHeaders });
    }

    // customer
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id, role: user.role },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { stripe_customer_id: customer.id },
      select: { id: true },
    });

    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/paywall/success`; // ✅ meilleur que /hub (success page)
    const cancelUrl = `${baseUrl}/signup?canceled=1&role=${encodeURIComponent(role)}&plan=${encodeURIComponent(plan)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        // ✅ cohérence webhook
        user_id: user.id,
        planKey,
        billingPeriod,
        signupRole: role,
        ...(analyticsSessionId ? { analytics_session_id: analyticsSessionId } : {}),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          planKey,
          billingPeriod,
          ...(analyticsSessionId ? { analytics_session_id: analyticsSessionId } : {}),
        },
      },
    });

    if (!session.url) {
      console.error("[signup] Stripe session created without url", { userId: user.id, planKey });
      return noStoreJson({ ok: false, error: "stripe_error" }, { status: 500, headers: rlHeaders });
    }

    return noStoreJson(
      { ok: true, checkoutUrl: session.url },
      { status: 200, headers: rlHeaders },
    );
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : "Unknown error";

    // Prisma unique (P2002)
    if (msg.includes("P2002") || msg.toLowerCase().includes("unique")) {
      if (maybeHideEmailConflict()) {
        return noStoreJson({ ok: false, error: "signup_failed" }, { status: 400, headers: rlHeaders });
      }
      return err("email_already_used", 409);
    }

    console.error("[signup] error:", msg);
    return noStoreJson({ ok: false, error: "server_error" }, { status: 500, headers: rlHeaders });
  }
}