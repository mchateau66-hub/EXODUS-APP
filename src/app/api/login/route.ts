// src/app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { createSessionResponseForUser } from "@/lib/auth";

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

function logPrismaError(err: unknown, meta: Record<string, unknown>) {
  const e = err as any;
  console.error("[api/login] prisma_error", {
    name: String(e?.name ?? "Error"),
    code: e?.code ? String(e.code) : undefined,
    message: String(e?.message ?? "").slice(0, 1200),
    meta,
    stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 12).join("\n") : undefined,
  });
}

export async function POST(req: NextRequest) {
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

  let user: { id: string; role: Role };
  try {
    user = await prisma.user.upsert({
      where: { email },
      update: {
        role,
        onboardingStep: 3,
        country: "FR",
        language: "fr",
      },
      create: {
        email,
        role,
        onboardingStep: 3,
        country: "FR",
        language: "fr",
      },
      select: { id: true, role: true },
    });
  } catch (err) {
    logPrismaError(err, { op: "user.upsert", role, hasEmail: Boolean(email) });
    const res = NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 503 });
    res.headers.set("cache-control", "no-store");
    return res;
  }

  const res = await createSessionResponseForUser(
    user.id,
    { ok: true, user, plan },
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

  return res;
}
