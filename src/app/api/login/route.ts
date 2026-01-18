// src/app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual, randomUUID } from "node:crypto"
import { prisma } from "@/lib/db"

type Plan = "free" | "master" | "premium"
type Role = "athlete" | "coach" | "admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

function devLoginEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "1"
}

function isE2E(req: NextRequest): boolean {
  return (req.headers.get("x-e2e") ?? "").trim() === "1"
}

function isLocalhost(req: NextRequest): boolean {
  const host = (req.headers.get("host") ?? "").toLowerCase()
  return host.startsWith("localhost") || host.startsWith("127.0.0.1")
}

function tokenOk(req: NextRequest): boolean {
  const expected = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim()
  if (!expected) return true

  const got = (req.headers.get("x-e2e-token") ?? "").trim()
  if (!got) return false

  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function pickPlan(v: unknown): Plan {
  const s = String(v ?? "").toLowerCase().trim()
  if (s === "pro") return "premium"
  return s === "master" || s === "premium" ? (s as Plan) : "free"
}

function pickRole(v: unknown): Role {
  const s = String(v ?? "").toLowerCase().trim()
  return s === "coach" || s === "admin" ? (s as Role) : "athlete"
}

function isHttps(req: NextRequest): boolean {
  return (
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ||
    req.nextUrl.protocol === "https:"
  )
}

function serializeErr(err: unknown) {
  const e = err as any
  return {
    name: String(e?.name ?? "Error"),
    message: String(e?.message ?? "").slice(0, 2000),
    stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 18).join("\n") : undefined,
  }
}

/**
 * Fallback: créer une session via le modèle Session (ou variantes), poser cookies sid/session + plan.
 * (utile si createSessionResponseForUser n'existe pas ou crash)
 */
async function fallbackCreateSessionAndCookies(req: NextRequest, userId: string, plan: Plan) {
  const p: any = prisma as any

  const models = [
    p.session,
    p.sessions,
    p.userSession,
    p.userSessions,
    p.authSession,
    p.authSessions,
  ].filter(Boolean)

  if (!models.length) {
    throw new Error("No session model found on prisma (session/userSession/authSession).")
  }

  const secure = isHttps(req)

  const attempts: any[] = [
    { user_id: userId },
    { userId },
    { user: { connect: { id: userId } } },
    { user_id: userId, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 6) },
    { userId, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 6) },
  ]

  let lastErr: any = null
  for (const m of models) {
    for (const data of attempts) {
      try {
        const created = await m.create({ data, select: { id: true } })
        const sid = String(created.id)

        const res = NextResponse.json(
          { ok: true, via: "fallback", sid, userId, plan },
          { headers: { "cache-control": "no-store" } },
        )

        res.cookies.set("sid", sid, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: 60 * 60 * 6,
        })

        // certains de tes flows utilisent "session" aussi
        res.cookies.set("session", sid, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: 60 * 60 * 6,
        })

        res.cookies.set("plan", plan, {
          httpOnly: false,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        })

        res.headers.set("x-e2e-login", "1")
        return res
      } catch (e) {
        lastErr = e
      }
    }
  }

  throw lastErr ?? new Error("fallback session create failed (unknown)")
}

/**
 * ✅ Ensure onboarding completeness for tests:
 * - athletes: create AthleteProfile (otherwise /hub redirects to onboarding step-1)
 * - coaches: create Coach record
 * - set onboardingStep to 3 + JSON answers to non-null-ish values
 */
async function ensureE2EOnboarding(userId: string, role: Role) {
  const now = new Date()

  // met à jour le user "au propre" (sans rien nuller)
  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingStep: 3,
      onboardingStep1Answers: { e2e: true, at: now.toISOString() },
      onboardingStep2Answers: { e2e: true, at: now.toISOString() },
    },
    select: { id: true },
  })

  if (role === "athlete") {
    // AthleteProfile requis par ton UX (sinon redirect onboarding step-1)
    await prisma.athleteProfile.upsert({
      where: { user_id: userId },
      update: {
        // on garde simple
        objectiveSummary: "E2E objective summary",
        updated_at: now,
      },
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
    })
  }

  if (role === "coach") {
    // Coach requis pour certains écrans coach
    const slug = `coach-${userId.slice(0, 8)}-${randomUUID().slice(0, 6)}`
    await prisma.coach.upsert({
      where: { user_id: userId },
      update: {
        name: "Coach E2E",
        subtitle: "E2E",
      },
      create: {
        user_id: userId,
        slug,
        name: "Coach E2E",
        subtitle: "E2E",
        avatarInitial: "E",
      },
      select: { id: true },
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    // cache route en prod sauf e2e
    if (!devLoginEnabled()) return new Response("Not found", { status: 404 })

    const e2e = isE2E(req)
    const local = isLocalhost(req)
    const isProd = process.env.NODE_ENV === "production"

    // prod => uniquement e2e (+ token si défini)
    // dev  => e2e ok (+ token si défini), sinon browser ok si localhost (ou ALLOW_BROWSER_DEV_LOGIN)
    if (isProd) {
      if (!e2e) return new Response("Not found", { status: 404 })
      if (!tokenOk(req)) return new Response("Not found", { status: 404 })
    } else {
      if (e2e) {
        if (!tokenOk(req)) return new Response("Not found", { status: 404 })
      } else {
        if (!local && process.env.ALLOW_BROWSER_DEV_LOGIN !== "1") {
          return new Response("Not found", { status: 404 })
        }
      }
    }

    const body = (await req.json().catch(() => ({}))) as {
      email?: string
      role?: Role
      plan?: Plan | "pro"
      maxAgeSeconds?: number
      maxAge?: number
    }

    const email = String(body.email ?? `dev@local.test`).toLowerCase().trim()
    const role = pickRole(body.role ?? "athlete")
    const plan = pickPlan(body.plan)

    const rawMaxAge = body.maxAgeSeconds ?? body.maxAge
    const maxAgeSeconds =
      typeof rawMaxAge === "number" && Number.isFinite(rawMaxAge) && rawMaxAge > 0
        ? Math.floor(rawMaxAge)
        : undefined

    // 1) upsert user
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role,
        onboardingStep: 3,
        country: "FR",
        language: "fr",
        status: "active",
      },
      create: {
        email,
        role,
        onboardingStep: 3,
        country: "FR",
        language: "fr",
        status: "active",
      },
      select: { id: true, role: true },
    })

    // 2) ✅ ensure onboarding objects exist (critical for /hub)
    await ensureE2EOnboarding(user.id, role)

    // 3) essai normal via lib/auth
    try {
      const mod: any = await import("@/lib/auth")
      const createSessionResponseForUser = mod?.createSessionResponseForUser
      if (typeof createSessionResponseForUser !== "function") {
        throw new Error("createSessionResponseForUser is not a function (missing export?)")
      }

      const res: NextResponse = await createSessionResponseForUser(
        user.id,
        { ok: true, user, plan },
        req,
        maxAgeSeconds ? { maxAgeSeconds } : {},
      )

      res.cookies.set("plan", plan, {
        httpOnly: false,
        sameSite: "lax",
        secure: isHttps(req),
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      })

      res.headers.set("x-e2e-login", "1")
      return res
    } catch (err) {
      // fallback session DB + cookies sid/session
      const debug = e2e || local
      console.error("[api/login] createSessionResponseForUser failed, fallback => prisma session", {
        userId: user.id,
        plan,
        detail: debug ? serializeErr(err) : undefined,
      })

      return await fallbackCreateSessionAndCookies(req, user.id, plan)
    }
  } catch (err) {
    const payload = { ok: false, error: "api_login_crash", detail: serializeErr(err) }
    console.error("[api/login] handler_crash", payload)
    return NextResponse.json(payload, { status: 500, headers: { "cache-control": "no-store" } })
  }
}
