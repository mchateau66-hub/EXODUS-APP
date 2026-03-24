import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeFeature } from "@/lib/authorizeFeature";
import { limitSeconds, rateHeaders, rateKeyFromRequest } from "@/lib/ratelimit";
import { getErrorCode, getHttpStatus } from "@/lib/http-error";
import { trackMessageSent } from "@/lib/usage-tracking";

export const runtime = "nodejs";

function jsonWithHeaders(
  body: unknown,
  init: ResponseInit = {},
  extraHeaders?: Headers,
) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");

  if (extraHeaders) {
    extraHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export async function POST(req: NextRequest) {
  try {
    // 🔐 Token signé + feature premium
    const auth = await authorizeFeature(req, "messages.unlimited", { mode: "bearer" });
    const userId = String(auth.userId);

    const limitN = parseInt(process.env.RATELIMIT_MESSAGES_SEND_LIMIT || "12", 10);
    const windowS = parseInt(process.env.RATELIMIT_MESSAGES_SEND_WINDOW_S || "60", 10);

    const rlKey = rateKeyFromRequest(req, userId);
    const rl = await limitSeconds(
      "messages_send",
      rlKey,
      limitN > 0 ? limitN : 12,
      Math.max(1, windowS),
    );
    const rlHeaders = rateHeaders(rl);

    if (!rl.ok) {
      return jsonWithHeaders(
        { ok: false, error: "rate_limited" },
        { status: 429 },
        rlHeaders,
      );
    }

    const body = await req.json();
    const { content, coachId } = body as { content?: string; coachId?: string };

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return jsonWithHeaders(
        { ok: false, error: "invalid_payload" },
        { status: 400 },
        rlHeaders,
      );
    }

    if (coachId != null && (typeof coachId !== "string" || coachId.trim().length === 0)) {
      return jsonWithHeaders(
        { ok: false, error: "invalid_coach_id" },
        { status: 400 },
        rlHeaders,
      );
    }

    await prisma.message.create({
      data: {
        user_id: userId,
        coach_id: coachId?.trim() ?? null,
        content: content.trim(),
      },
    });

    await trackMessageSent(userId);

    return jsonWithHeaders({ ok: true }, { status: 200 }, rlHeaders);
  } catch (err: unknown) {
    const status = getHttpStatus(err) ?? 403;
    const code = getErrorCode(err) ?? (err instanceof Error ? err.message : null) ?? "forbidden";
    return jsonWithHeaders(
      { ok: false, error: code },
      { status },
    );
  }
}