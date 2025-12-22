// src/app/api/sat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { requireJson, requireSameOrigin } from "@/lib/security";
import { limit, rateHeaders } from "@/lib/ratelimit";
import { issueSAT } from "@/lib/sat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Réponse "legacy" quand l'utilisateur n'a pas d'abonnement (GET)
function makeDefaultSatResponse() {
  return {
    pro: false,
    status: "NONE",
    planKey: null as string | null,
    planName: null as string | null,
    expiresAt: null as Date | string | null,
    trialEndAt: null as Date | string | null,
  };
}

type SatIssueBody = {
  feature?: unknown; // ex: "contacts.view"
  method?: unknown;  // ex: "GET"
  path?: unknown;    // ex: "/api/contacts"
};

function normStr(x: unknown) {
  return typeof x === "string" ? x.trim() : "";
}

function isHttpMethod(m: string) {
  return ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(m);
}

function isSafePath(p: string) {
  return p.startsWith("/") && !p.startsWith("//") && !p.includes("://");
}

function isEntitlementActive(ent: { starts_at: Date; expires_at: Date | null }, now: Date) {
  if (ent.starts_at > now) return false;
  if (ent.expires_at && ent.expires_at <= now) return false;
  return true;
}

/**
 * GET /api/sat  (legacy)
 * Retourne status abonnement/pro (sans SAT one-time)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let userId = searchParams.get("userId");

    if (!userId) {
      const sessionCtx = await getUserFromSession().catch(() => null);
      if ((sessionCtx as any)?.user?.id) userId = (sessionCtx as any).user.id;
    }

    if (!userId) return NextResponse.json(makeDefaultSatResponse(), { status: 200 });

    const entitlement = await prisma.userEntitlement.findFirst({
      where: { user_id: userId },
      include: {
        subscription: { include: { plan: true } },
      },
      orderBy: { created_at: "desc" },
    });

    if (!entitlement || !entitlement.subscription) {
      return NextResponse.json(makeDefaultSatResponse(), { status: 200 });
    }

    const sub = entitlement.subscription;

    return NextResponse.json(
      {
        pro: sub.status === "active",
        status: sub.status,
        planKey: sub.plan_key,
        planName: sub.plan?.name ?? null,
        expiresAt: sub.expires_at ?? null,
        trialEndAt: sub.trial_end_at ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/sat", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/sat
 * Emet un SAT one-time (anti-replay) pour un endpoint précis (method+path) et un "feature" précis.
 *
 * Body: { feature, method, path }
 * Header (retour): RateLimit-*
 */
export async function POST(req: NextRequest) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const jsonOnly = requireJson(req);
  if (jsonOnly) return jsonOnly;

  const session = await getUserFromSession().catch(() => null);
  const user = (session as any)?.user;

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Rate-limit SAT issuance
  const limitN = parseInt(process.env.RATELIMIT_SAT_LIMIT || "20", 10);
  const windowS = parseInt(process.env.RATELIMIT_SAT_WINDOW_S || "60", 10);
  const rl = await limit("sat", String(user.id), Number.isFinite(limitN) ? limitN : 20, windowS * 1000);
  const rlH = rateHeaders(rl);

  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: rlH });
  }

  let body: SatIssueBody = {};
  try {
    body = (await req.json()) as SatIssueBody;
  } catch {
    body = {};
  }

  const feature = normStr(body.feature);
  const method = normStr(body.method).toUpperCase();
  const path = normStr(body.path);

  if (!feature) return NextResponse.json({ ok: false, error: "missing_feature" }, { status: 400, headers: rlH });
  if (!method || !isHttpMethod(method)) {
    return NextResponse.json({ ok: false, error: "invalid_method" }, { status: 400, headers: rlH });
  }
  if (!path || !isSafePath(path)) {
    return NextResponse.json({ ok: false, error: "invalid_path" }, { status: 400, headers: rlH });
  }

  // Policy: features "premium-only" (fail closed)
  // - contacts.view, whatsapp.handoff, chat.media => doivent être dans entitlements actifs
  // - chat.send => autorisé (quota géré côté /api/messages)
  const premiumGated = new Set(["contacts.view", "whatsapp.handoff", "chat.media"]);

  if (premiumGated.has(feature)) {
    const now = new Date();
    const entitlements = await prisma.userEntitlement.findMany({
      where: { user_id: String(user.id) },
      select: { feature_key: true, starts_at: true, expires_at: true },
    });

    const active = entitlements.filter((e) => isEntitlementActive(e, now));
    const features = new Set(active.map((e) => String(e.feature_key)));

    if (!features.has(feature)) {
      return NextResponse.json(
        { ok: false, error: "not_entitled", feature },
        { status: 403, headers: rlH },
      );
    }
  } else if (feature !== "chat.send") {
    // Unknown feature => fail closed
    return NextResponse.json({ ok: false, error: "unknown_feature" }, { status: 400, headers: rlH });
  }

  try {
    const { token, expMs } = await issueSAT({
      userId: String(user.id),
      feature,
      method,
      path,
    });

    return NextResponse.json({ ok: true, token, exp: expMs }, { status: 200, headers: rlH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server_error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: rlH });
  }
}
