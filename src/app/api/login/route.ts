// src/app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

type Plan = "free" | "master" | "premium";
type Role = "athlete" | "coach" | "admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function devLoginEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "1";
}

function isE2E(req: NextRequest): boolean {
  return (req.headers.get("x-e2e") ?? "").trim() === "1";
}

function isLocalhost(req: NextRequest): boolean {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function tokenOk(req: NextRequest): boolean {
  const expected = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();
  if (!expected) return true;

  const got = (req.headers.get("x-e2e-token") ?? "").trim();
  if (!got) return false;

  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function pickPlan(v: unknown): Plan {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "pro") return "premium";
  return s === "master" || s === "premium" ? (s as Plan) : "free";
}

function pickRole(v: unknown): Role {
  const s = String(v ?? "").toLowerCase().trim();
  return s === "coach" || s === "admin" ? (s as Role) : "athlete";
}

function isHttps(req: NextRequest): boolean {
  return (
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ||
    req.nextUrl.protocol === "https:"
  );
}

function serializeErr(err: unknown) {
  const e = err as any;
  return {
    name: String(e?.name ?? "Error"),
    message: String(e?.message ?? "").slice(0, 2000),
    stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 18).join("\n") : undefined,
  };
}

async function fallbackCreateSessionAndCookies(req: NextRequest, userId: string, plan: Plan) {
  const p: any = prisma as any;

  const models = [p.session, p.sessions, p.userSession, p.userSessions, p.authSession, p.authSessions].filter(
    Boolean,
  );

  if (!models.length) {
    throw new Error("No session model found on prisma (session/userSession/authSession).");
  }

  const secure = isHttps(req);

  const attempts: any[] = [
    { user_id: userId },
    { userId },
    { user: { connect: { id: userId } } },
    { user_id: userId, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 6) },
    { userId, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 6) },
  ];

  let lastErr: any = null;

  for (const m of models) {
    for (const data of attempts) {
      try {
        const created = await m.create({ data, select: { id: true } });
        const sid = String(created.id);

        const res = NextResponse.json({ ok: true, via: "fallback", sid, userId, plan }, { headers: { "cache-control": "no-store" } });

        res.cookies.set("sid", sid, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: 60 * 60 * 6,
        });

        res.cookies.set("session", sid, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: 60 * 60 * 6,
        });

        res.cookies.set("plan", plan, {
          httpOnly: false,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });

        res.headers.set("x-e2e-login", "1");
        return res;
      } catch (e) {
        lastErr = e;
      }
    }
  }

  throw lastErr ?? new Error("fallback session create failed (unknown)");
}

/**
 * ✅ Seed "onboarding completed" pour éviter redirect /hub -> /onboarding/*
 * - On le fait uniquement en E2E (header x-e2e: 1)
 * - On seed aussi AthleteProfile (champs non-nullables)
 */
async function ensureE2EAthleteOnboarded(userId: string) {
  const now = new Date();

  // ces structures JSON sont volontairement "simples" :
  // l'app a juste besoin que les étapes aient un contenu cohérent.
  const step1 = {
    visibility: "semi_public", // ou "public"/"private" selon ton UI
    tagline: "E2E athlete",
    athleteType: "beginner",
    updatedAt: now.toISOString(),
  };

  const step2 = {
    goal: "general_fitness",
    sport: "running",
    updatedAt: now.toISOString(),
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingStep: 3,
      onboardingStep1Answers: step1 as any,
      onboardingStep2Answers: step2 as any,

      // petits defaults pour éviter d’autres guards/UI
      name: "E2E Athlete",
      bio: "E2E seeded profile",
      country: "FR",
      language: "fr",
    },
  });

  await prisma.athleteProfile.upsert({
    where: { user_id: userId },
    update: {
      goalType: "general",
      timeframe: "unspecified",
      experienceLevel: "beginner",
      context: "e2e",
      objectiveSummary: "e2e profile",
      updated_at: now,
    },
    create: {
      user_id: userId,
      goalType: "general",
      timeframe: "unspecified",
      experienceLevel: "beginner",
      context: "e2e",
      objectiveSummary: "e2e profile",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!devLoginEnabled()) return new Response("Not found", { status: 404 });

    const e2e = isE2E(req);
    const local = isLocalhost(req);
    const isProd = process.env.NODE_ENV === "production";

    // prod => uniquement e2e (+ token si défini)
    // dev => e2e ok (+ token si défini), sinon browser ok si localhost
    if (isProd) {
      if (!e2e) return new Response("Not found", { status: 404 });
      if (!tokenOk(req)) return new Response("Not found", { status: 404 });
    } else {
      if (e2e) {
        if (!tokenOk(req)) return new Response("Not found", { status: 404 });
      } else {
        if (!local && process.env.ALLOW_BROWSER_DEV_LOGIN !== "1") {
          return new Response("Not found", { status: 404 });
        }
      }
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      role?: Role;
      plan?: Plan | "pro";
      maxAgeSeconds?: number;
      maxAge?: number;
    };

    const email = String(body.email ?? `dev@local.test`).toLowerCase().trim();
    const role = pickRole(body.role ?? "athlete");
    const plan = pickPlan(body.plan);

    const rawMaxAge = body.maxAgeSeconds ?? body.maxAge;
    const maxAgeSeconds =
      typeof rawMaxAge === "number" && Number.isFinite(rawMaxAge) && rawMaxAge > 0
        ? Math.floor(rawMaxAge)
        : undefined;

    // 1) upsert user
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role,
        ...(e2e ? { onboardingStep: 3 } : {}), // ✅ uniquement E2E
        country: "FR",
        language: "fr",
      },
      create: {
        email,
        role,
        onboardingStep: e2e ? 3 : 0,
        country: "FR",
        language: "fr",
        theme: "light",
        keywords: [],
      },
      select: { id: true, role: true, onboardingStep: true },
    });

    // 1.5) seed onboarding + athleteProfile si E2E + athlete
    if (e2e && String(user.role).toLowerCase() === "athlete") {
      await ensureE2EAthleteOnboarded(user.id);
    }

    // 2) essai normal via lib/auth (import dynamique pour attraper les erreurs de module)
    try {
      const mod: any = await import("@/lib/auth");
      const createSessionResponseForUser = mod?.createSessionResponseForUser;

      if (typeof createSessionResponseForUser !== "function") {
        throw new Error("createSessionResponseForUser is not a function (missing export?)");
      }

      const res: NextResponse = await createSessionResponseForUser(
        user.id,
        { ok: true, user: { ...user, onboardingStep: e2e ? 3 : user.onboardingStep }, plan },
        req,
        maxAgeSeconds ? { maxAgeSeconds } : {},
      );

      res.cookies.set("plan", plan, {
        httpOnly: false,
        sameSite: "lax",
        secure: isHttps(req),
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      res.headers.set("x-e2e-login", "1");
      return res;
    } catch (err) {
      const debug = e2e || local;
      console.error("[api/login] createSessionResponseForUser failed, fallback => prisma session", {
        userId: user.id,
        plan,
        detail: debug ? serializeErr(err) : undefined,
      });

      return await fallbackCreateSessionAndCookies(req, user.id, plan);
    }
  } catch (err) {
    const payload = { ok: false, error: "api_login_crash", detail: serializeErr(err) };
    console.error("[api/login] handler_crash", payload);
    return NextResponse.json(payload, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
