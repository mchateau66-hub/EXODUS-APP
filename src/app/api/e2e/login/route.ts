// src/app/api/e2e/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionResponseForUser } from "@/lib/auth";

type Plan = "free" | "master" | "premium";
type Role = "athlete" | "coach" | "admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function devLoginEnabled() {
  // Backdoor autorisé seulement si explicitement activé
  return process.env.ALLOW_DEV_LOGIN === "1";
}

function isE2E(req: NextRequest): boolean {
  return (req.headers.get("x-e2e") ?? "").trim() === "1";
}

function tokenOk(req: NextRequest): boolean {
  const expected = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();
  if (!expected) return false;
  const got = (req.headers.get("x-e2e-token") ?? "").trim();
  return got && got === expected;
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
  return req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
}

export async function POST(req: NextRequest) {
  // 1) caché si pas activé
  if (!devLoginEnabled()) return new Response("Not found", { status: 404 });

  // 2) exige header e2e
  if (!isE2E(req)) return new Response("Not found", { status: 404 });

  // 3) exige token secret
  if (!tokenOk(req)) return new Response("Not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    role?: Role;
    plan?: Plan | "pro";
    maxAgeSeconds?: number;
    maxAge?: number; // compat ancienne signature
  };

  const email = String(body.email ?? `e2e@exodus.local`).toLowerCase().trim();
  const role = pickRole(body.role ?? "athlete");
  const plan = pickPlan(body.plan ?? "free");

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

  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, role },
    select: { id: true, role: true },
  });

  // Pose cookie session + renvoie sid dans JSON (via auth.ts)
  const res = await createSessionResponseForUser(
    user.id,
    { ok: true, user, plan },
    req,
    maxAgeSeconds ? { maxAgeSeconds } : {},
  );

  // cookie plan (non sensible)
  res.cookies.set("plan", plan, {
    httpOnly: false,
    sameSite: "lax",
    secure: isHttps(req),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  res.headers.set("cache-control", "no-store");
  return res;
}

// (optionnel) Si quelqu’un tape l’URL dans un navigateur
export async function GET() {
  return new Response("Not found", { status: 404 });
}
