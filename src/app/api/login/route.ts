// src/app/api/login/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionResponseForUser } from "@/lib/auth";

type Plan = "free" | "master" | "premium";
type Role = "athlete" | "coach" | "admin";

export const runtime = "nodejs";

function devLoginEnabled() {
  // Backdoor login uniquement dev/CI (recommandé)
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "1";
}

function pickPlan(v: unknown): Plan {
  return v === "master" || v === "premium" ? v : "free";
}

function pickRole(v: unknown): Role {
  return v === "coach" || v === "admin" ? v : "athlete";
}

export async function POST(req: NextRequest) {
  if (!devLoginEnabled()) return new Response("Not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    role?: Role;
    plan?: Plan;
  };

  const email = (body.email ?? "admin@local.test").toLowerCase().trim();
  const role = pickRole(body.role ?? "admin");
  const plan = pickPlan(body.plan);

  // ⚠️ suppose que User.email est unique
  // ✅ IMPORTANT: on ne renvoie PAS l'email au client (PII-Guard)
  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, role },
    select: { id: true, role: true },
  });

  const res = await createSessionResponseForUser(user.id, {
    ok: true,
    user, // {id, role} only
    plan,
  });

  // cookie plan (non sensible)
  res.cookies.set("plan", plan, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
