// src/lib/auth.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

type CreateSessionOpts = { maxAgeSeconds?: number };

const SESSION_COOKIE_CANDIDATES = (process.env.SESSION_COOKIE_NAMES ?? "sid,session")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_COOKIE_NAME = SESSION_COOKIE_CANDIDATES[0] ?? "sid";

/**
 * Détermine si les cookies doivent être Secure.
 * - Si req est fourni : se base sur le protocole réel (x-forwarded-proto / req.nextUrl.protocol)
 * - Sinon : fallback sur NODE_ENV (prod => secure)
 */
function secureCookieFromReq(req?: NextRequest) {
  if (req) {
    const xfProto = req.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    if (xfProto) return xfProto === "https";
    return req.nextUrl.protocol === "https:";
  }
  return process.env.NODE_ENV === "production";
}

function prismaModels(db: any) {
  return {
    session: db.session ?? db.sessions,
  };
}

async function createSessionRow(sessionModel: any, data: any) {
  try {
    return await sessionModel.create({ data: { ...data, last_seen_at: new Date() } });
  } catch {
    return await sessionModel.create({ data });
  }
}

/**
 * Crée une session DB + pose le cookie session.
 * Robustesse:
 * - pose la session sur TOUS les noms candidats (sid + session + ...)
 *   => évite invalid_session si une partie de l'app lit un autre nom.
 */
export async function createSessionResponseForUser<T extends Record<string, any>>(
  userId: string,
  payload: T,
  req?: NextRequest,
  opts: CreateSessionOpts = {},
) {
  const { session } = prismaModels(prisma as any);
  if (!session?.create) {
    const res = NextResponse.json({ ok: false, error: "session_model_missing" }, { status: 500 });
    res.headers.set("cache-control", "no-store");
    return res;
  }

  const sid = randomUUID();

  try {
    await createSessionRow(session, { id: sid, user_id: userId });
  } catch (err) {
    console.error("[auth] createSessionRow_failed", {
      name: (err as any)?.name,
      code: (err as any)?.code,
      message: String((err as any)?.message ?? "").slice(0, 800),
    });
    const res = NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 503 });
    res.headers.set("cache-control", "no-store");
    return res;
  }

  // ✅ sid dans le JSON (utile E2E), sans PII
  const res = NextResponse.json({ ...payload, sid }, { status: 200 });
  res.headers.set("cache-control", "no-store");

  const secure = secureCookieFromReq(req);
  const maxAge = opts.maxAgeSeconds ?? 60 * 60 * 24 * 30;

  const names = SESSION_COOKIE_CANDIDATES.length ? SESSION_COOKIE_CANDIDATES : [DEFAULT_COOKIE_NAME];

  for (const name of names) {
    res.cookies.set(name, sid, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge,
    });
  }

  return res;
}

export async function deleteSessionBySid(sid: string) {
  const { session } = prismaModels(prisma as any);
  if (!session?.delete) return;
  await session.delete({ where: { id: sid } }).catch(() => null);
}

export async function getUserFromSession() {
  const store = await Promise.resolve(nextCookies() as any);

  let sid: string | null = null;

  const names = SESSION_COOKIE_CANDIDATES.length ? SESSION_COOKIE_CANDIDATES : [DEFAULT_COOKIE_NAME];

  for (const name of names) {
    const c = store.get?.(name);
    const v = typeof c === "string" ? c : c?.value;
    if (v && String(v).trim()) {
      sid = String(v).trim();
      break;
    }
  }

  if (!sid) return null;

  const { session } = prismaModels(prisma as any);
  if (!session?.findUnique) return null;

  const s = await session
    .findUnique({ where: { id: sid }, include: { user: true } })
    .catch(() => null);

  if (!s?.user) return null;

  if (session.update) {
    session.update({ where: { id: sid }, data: { last_seen_at: new Date() } }).catch(() => null);
  }

  return { user: s.user, sid };
}

function expireCookie(
  res: NextResponse,
  name: string,
  opts: { httpOnly: boolean; secure: boolean; sameSite?: "lax" | "strict" | "none" } = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  },
) {
  res.cookies.set({
    name,
    value: "",
    path: "/",
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite ?? "lax",
    secure: opts.secure,
    expires: new Date(0),
    maxAge: 0,
  });
}

/**
 * Efface les cookies de session (toutes variantes).
 */
export function clearSessionCookies(res: NextResponse, req?: NextRequest) {
  void req;

  const names = SESSION_COOKIE_CANDIDATES.length ? SESSION_COOKIE_CANDIDATES : [DEFAULT_COOKIE_NAME];

  for (const name of names) {
    expireCookie(res, name, { httpOnly: true, secure: false, sameSite: "lax" });
    expireCookie(res, name, { httpOnly: true, secure: true, sameSite: "lax" });
  }
}
