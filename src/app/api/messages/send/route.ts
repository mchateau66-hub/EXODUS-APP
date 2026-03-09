// src/app/api/messages/send/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFeature } from "@/lib/entitlements-guard";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 🔐 Token signé + feature premium
    const claim = await requireFeature(req, "messages.unlimited");
    const userId = String(claim.sub);

    const body = await req.json();
    const { content, coachId } = body as { content?: string; coachId?: string };

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    // coachId optionnel (car coach_id est nullable dans Prisma)
    if (coachId != null && (typeof coachId !== "string" || coachId.trim().length === 0)) {
      return NextResponse.json({ ok: false, error: "invalid_coach_id" }, { status: 400 });
    }


    await prisma.message.create({
      data: {
        user_id: userId,
        coach_id: coachId?.trim() ?? null,
        content: content.trim(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "forbidden" },
      { status: 403 },
    );
  }
}