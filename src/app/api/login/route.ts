// src/app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { createSessionResponseForUser } from "@/lib/auth";

type Plan = "free" | "master" | "premium";
type Role = "athlete" | "coach" | "admin";

export const runtime = "nodejs";

function devLoginEnabled() {
  // Backdoor login uniquement dev/CI, ou si explicitement autorisé (staging/preview)
  if ((process.env.ALLOW_DEV_LOGIN ?? "").trim() === "1") return true;
  return process.env.NODE_ENV !== "production";
}

function safeEqual(a: string, b: string) {
  // compare constant-time (évite timing attacks)
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

function isE2E(req: NextRequest): boolean {
  // ✅ endpoint backdoor protégé par header E2E
  const e2e = (req.headers.get("x-e2e") ?? "").trim() === "1";
  if (!e2e) return false;

  // ✅ en prod (ou si token défini), on exige un token en plus
  const expected = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();
  if (!expected) {
    // si pas de token défini, on n’autorise que hors prod
    return process.env.NODE_ENV !== "production";
  }

  const got = (req.headers.get("x-e2e-token") ?? "").trim();
  return got.length > 0 && safeEqual(got, expected);
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
  // Vercel/Proxy friendly
  const xfProto = (req.headers.get("x-forwarded-proto") ?? "").toLowerCase();
  if (xfProto.includes("https")) return true;
  return req.nextUrl.protocol === "https:";
}

function logPrismaError(err: unknown, meta: Record<string, unknown>) {
  const e = err as any;
  const name = String(e?.name ?? "Error");
  const message = String(e?.message ?? "");
  const code = e?.code ? String(e.code) : undefined;

  console.error("[api/login] prisma_error", {
    name,
    code,
    message: message.slice(0, 1200),
    meta,
    stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 12).join("\n") : undefined,
  });
}

export async function POST(req: NextRequest) {
  // ✅ 1) caché en prod (sauf ALLOW_DEV_LOGIN=1)
  if (!devLoginEnabled()) return new Response("Not found", { status: 404 });

  // ✅ 2) verrou CI-safe : exige x-e2e=1 (+ token en prod si défini)
  if (!isE2E(req)) return new Response("Not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    role?: Role;
    plan?: Plan | "pro";
    maxAgeSeconds?: number;
    maxAge?: number; // compat (helpers)
  };

  const email = String(body.email ?? "admin@local.test").toLowerCase().trim();
  const role = pickRole(body.role ?? "admin");
  const plan = pickPlan(body.plan);

  // ✅ compat maxAge/maxAgeSeconds
  const rawMaxAge =
    typeof body.maxAgeSeconds === "number"
      ? body.maxAgeSeconds
      : typeof body.maxAge === "number"
        ? body.maxAge
        : undefined;

  const maxAgeSeconds =
    typeof rawMaxAge === "number" && Number.isFinite(rawMaxAge) && rawMaxAge > 0
      ? Math.floor(rawMaxAge)
      : undefined;

  let user: { id: string; role: Role };
  try {
    user = await prisma.user.upsert({
      where: { email },
      update: { role },
      create: { email, role },
      select: { id: true, role: true },
    });
  } catch (err) {
    logPrismaError(err, { op: "user.upsert", role, hasEmail: Boolean(email) });

    const res = NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 503 });
    res.headers.set("cache-control", "no-store");
    return res;
  }

  // ✅ IMPORTANT: createSessionResponseForUser doit poser le cookie session (sid) en Path="/"
  const res = await createSessionResponseForUser(
    user.id,
    { ok: true, user, plan },
    req,
    maxAgeSeconds ? { maxAgeSeconds } : {},
  );

  // cache-safety
  res.headers.set("cache-control", "no-store");

  // cookie plan (non sensible)
  res.cookies.set("plan", plan, {
    httpOnly: false,
    sameSite: "lax",
    secure: isHttps(req),
    path: "/", // 🔥 critique pour être envoyé sur /paywall, /pro, etc.
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
