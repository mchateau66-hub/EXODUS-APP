// src/app/api/ads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getUserIdFromSession(sess: any): string | null {
  return (sess?.userId ?? sess?.id ?? sess?.user?.id ?? sess?.user?.userId) || null;
}

function clampDays(v: any, def = 30) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

function cleanText(v: any, max = 240): string | null {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max).trim() : s;
}

function cleanKeywords(raw: any): string[] {
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : raw && typeof raw === "object"
        ? Object.values(raw).flat()
        : [];

  const uniq = new Set<string>();
  for (const x of arr) {
    const k = String(x ?? "").trim();
    if (!k) continue;
    uniq.add(k.slice(0, 32));
    if (uniq.size >= 20) break;
  }
  return Array.from(uniq);
}

function clampLatLng(lat: any, lng: any): { lat: number | null; lng: number | null } {
  const la = Number(lat);
  const lo = Number(lng);
  const latOk = Number.isFinite(la) && la >= -90 && la <= 90;
  const lngOk = Number.isFinite(lo) && lo >= -180 && lo <= 180;
  return {
    lat: latOk ? la : null,
    lng: lngOk ? lo : null,
  };
}

function clampBudget(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100000, Math.floor(n)));
}

function hasOwn(obj: any, key: string) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * PATCH /api/ads/:id
 * Body:
 *  - { action: 'deactivate' }
 *  - { action: 'activate', durationDays?: number }
 *  - {
 *      action: 'update',
 *      title,
 *      goal?, sport?, keywords?, country?, city?, language?,
 *      budget_min?, budget_max?, lat?, lng?
 *    }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sess: any = await getUserFromSession();
  const userId = getUserIdFromSession(sess);
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, onboardingStep: true },
  });
  if (!me) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (String(me.role) !== "athlete") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if ((me.onboardingStep ?? 0) < 3) {
    return NextResponse.json({ ok: false, error: "onboarding_required" }, { status: 409 });
  }

  const id = params?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // ownership check
  const owned = await prisma.athleteAd.findFirst({
    where: { id, athlete_id: userId },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({} as any));
  const action = String(body?.action ?? "").toLowerCase();
  const now = new Date();

  // 1) deactivate
  if (action === "deactivate") {
    const updated = await prisma.athleteAd.update({
      where: { id },
      data: {
        status: "inactive",
        published_until: now,
      },
      select: { id: true, status: true, published_until: true, updated_at: true },
    });

    return NextResponse.json({ ok: true, item: updated }, { headers: { "cache-control": "no-store" } });
  }

  // 2) activate
  if (action === "activate") {
    const durationDays = clampDays(body?.durationDays, 30);

    const current = await prisma.athleteAd.findUnique({
      where: { id },
      select: { published_until: true },
    });

    const base = current?.published_until && current.published_until > now ? current.published_until : now;
    const publishedUntil = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const updated = await prisma.athleteAd.update({
      where: { id },
      data: {
        status: "active",
        published_until: publishedUntil,
      },
      select: { id: true, status: true, published_until: true, updated_at: true },
    });

    return NextResponse.json(
      { ok: true, item: updated, durationDays },
      { headers: { "cache-control": "no-store" } }
    );
  }

  // 3) update
  if (action === "update") {
    const title = cleanText(body?.title, 80);
    if (!title) {
      return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });
    }

    // Build Prisma-safe update payload (pas de null sur champs non-nullables)
    const data: Prisma.AthleteAdUpdateInput = { title };

    // goal/sport sont non-nullables dans ton schema => jamais null
    if (hasOwn(body, "goal")) data.goal = cleanText(body?.goal, 600) ?? "";
    if (hasOwn(body, "sport")) data.sport = cleanText(body?.sport, 80) ?? "";

    // keywords = Json NON-nullable => jamais null, toujours un tableau (même vide)
    if (hasOwn(body, "keywords")) {
      const kw = cleanKeywords(body?.keywords);
      data.keywords = kw as unknown as Prisma.InputJsonValue;
    }

    // country/city/language sont nullable => null autorisé pour "clear"
    if (hasOwn(body, "country")) {
      const raw = cleanText(body?.country, 2);
      const c = raw ? raw.toUpperCase() : null;
      data.country = c && /^[A-Z]{2}$/.test(c) ? c : null;
    }
    if (hasOwn(body, "city")) {
      data.city = cleanText(body?.city, 80); // string | null
    }
    if (hasOwn(body, "language")) {
      const raw = cleanText(body?.language, 12);
      data.language = raw ? raw.toLowerCase() : null;
    }

    // budgets (nullable)
    const hasBudgetMin = hasOwn(body, "budget_min");
    const hasBudgetMax = hasOwn(body, "budget_max");

    let budget_min = hasBudgetMin ? clampBudget(body?.budget_min) : undefined;
    let budget_max = hasBudgetMax ? clampBudget(body?.budget_max) : undefined;

    if (budget_min != null && budget_max != null && budget_min > budget_max) {
      [budget_min, budget_max] = [budget_max, budget_min];
    }

    if (hasBudgetMin) data.budget_min = budget_min ?? null;
    if (hasBudgetMax) data.budget_max = budget_max ?? null;

    // coords (nullable) : si lat ou lng est présent, on maj les 2
    if (hasOwn(body, "lat") || hasOwn(body, "lng")) {
      const coords = clampLatLng(body?.lat, body?.lng);
      data.lat = coords.lat;
      data.lng = coords.lng;
    }

    const updated = await prisma.athleteAd.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        goal: true,
        sport: true,
        keywords: true,
        country: true,
        city: true,
        language: true,
        budget_min: true,
        budget_max: true,
        lat: true,
        lng: true,
        status: true,
        published_until: true,
        updated_at: true,
      },
    });

    return NextResponse.json({ ok: true, item: updated }, { headers: { "cache-control": "no-store" } });
  }

  return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
}
