// src/app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

type Plan = "free" | "master" | "premium";
type Role = "athlete" | "coach" | "admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isE2E(req: NextRequest): boolean {
  return (req.headers.get("x-e2e") ?? "").trim() === "1";
}

function isLocalhost(req: NextRequest): boolean {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

/**
 * ✅ Token strict en prod/preview:
 * - si E2E_DEV_LOGIN_TOKEN n'est PAS défini en prod => login impossible (404)
 * - si défini => il faut x-e2e-token correct
 * - en dev/local => on reste permissif comme avant
 */
function tokenOk(req: NextRequest): boolean {
  const expected = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();
  const isProd = process.env.NODE_ENV === "production";

  // prod/preview: token DOIT exister
  if (isProd && !expected) return false;

  // dev: pas de token configuré => pas de contrôle
  if (!expected) return true;

  // dev/local: ne bloque pas sur token en localhost
  if (!isProd && isLocalhost(req)) return true;

  const got = (req.headers.get("x-e2e-token") ?? "").trim();
  if (!got) return false;

  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * ✅ En prod/preview:
 * - on autorise uniquement E2E + token
 * ✅ En dev:
 * - comportement existant (browser localhost possible)
 */
function devLoginEnabled(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return true;

  // prod/preview: uniquement E2E + token
  if (!isE2E(req)) return false;
  return tokenOk(req);
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

  const models = [
    p.session,
    p.sessions,
    p.userSession,
    p.userSessions,
    p.authSession,
    p.authSessions,
  ].filter(Boolean);

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

        const res = NextResponse.json(
          { ok: true, via: "fallback", sid, userId, plan },
          { headers: { "cache-control": "no-store" } },
        );

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

async function ensureE2EOnboarding(userId: string, role: Role) {
  const now = new Date();

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingStep: 3,
      onboardingStep1Answers: { e2e: true, at: now.toISOString() },
      onboardingStep2Answers: { e2e: true, at: now.toISOString() },
    },
    select: { id: true },
  });

  if (role === "athlete") {
    await prisma.athleteProfile.upsert({
      where: { user_id: userId },
      update: { objectiveSummary: "E2E objective summary" },
      create: {
        user_id: userId,
        goalType: "performance",
        customGoal: null,
        timeframe: "3_months",
        experienceLevel: "beginner",
        context: "E2E",
        objectiveSummary: "E2E objective summary",
      },
      select: { id: true },
    });
  }

  if (role === "coach") {
    const slug = `coach-${userId.slice(0, 8)}-${randomUUID().slice(0, 6)}`;
    await prisma.coach.upsert({
      where: { user_id: userId },
      update: { name: "Coach E2E", subtitle: "E2E" },
      create: {
        user_id: userId,
        slug,
        name: "Coach E2E",
        subtitle: "E2E",
        avatarInitial: "E",
      },
      select: { id: true },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ gate unique
    if (!devLoginEnabled(req)) return new Response("Not found", { status: 404 });

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

    const user0 = await prisma.user.upsert({
      where: { email },
      update: {
        role,
        onboardingStep: 3,
        onboardingStep1Answers: { e2e: true, at: new Date().toISOString() },
        onboardingStep2Answers: { e2e: true, at: new Date().toISOString() },
        country: "FR",
        language: "fr",
        status: "active",
      },
      create: {
        email,
        role,
        onboardingStep: 3,
        onboardingStep1Answers: { e2e: true, at: new Date().toISOString() },
        onboardingStep2Answers: { e2e: true, at: new Date().toISOString() },
        country: "FR",
        language: "fr",
        status: "active",
      },
      select: { id: true, email: true, role: true, onboardingStep: true },
    });

    await ensureE2EOnboarding(user0.id, role);

    const userForSession =
      (await prisma.user.findUnique({
        where: { id: user0.id },
        select: {
          id: true,
          email: true,
          role: true,
          onboardingStep: true,
          country: true,
          language: true,
          status: true,
        },
      })) ?? user0;

    try {
      const mod: any = await import("@/lib/auth");
      const createSessionResponseForUser = mod?.createSessionResponseForUser;

      if (typeof createSessionResponseForUser !== "function") {
        throw new Error("createSessionResponseForUser is not a function (missing export?)");
      }

      const res: NextResponse = await createSessionResponseForUser(
        userForSession.id,
        { ok: true, user: userForSession, plan },
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
      res.headers.set("x-e2e-user-step", String((userForSession as any).onboardingStep ?? ""));
      return res;
    } catch (err) {
      const debug = isE2E(req) || isLocalhost(req);
      console.error("[api/login] createSessionResponseForUser failed, fallback => prisma session", {
        userId: userForSession.id,
        plan,
        detail: debug ? serializeErr(err) : undefined,
      });

      const res = await fallbackCreateSessionAndCookies(req, userForSession.id, plan);
      res.headers.set("x-e2e-user-step", String((userForSession as any).onboardingStep ?? ""));
      return res;
    }
  } catch (err) {
    const payload = { ok: false, error: "api_login_crash", detail: serializeErr(err) };
    console.error("[api/login] handler_crash", payload);
    return NextResponse.json(payload, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
