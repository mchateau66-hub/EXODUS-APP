import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const ctx = await getUserFromSession();
  if (!ctx) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { id: true, role: true } });
  if (!me) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });

  if (String(me.role).toLowerCase() !== "coach") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const documents = await prisma.coachDocument.findMany({
    where: { user_id: me.id },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json({ ok: true, documents }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const ctx = await getUserFromSession();
  if (!ctx) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { id: true, role: true } });
  if (!me) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });

  if (String(me.role).toLowerCase() !== "coach") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind ?? "");
  const title = body?.title ? String(body.title) : null;
  const url = String(body?.url ?? "").trim();

  if (!url) return NextResponse.json({ ok: false, error: "missing_url" }, { status: 400 });
  if (!["diploma", "certification", "other"].includes(kind)) {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }

  // MVP: url-only (upload réel plus tard)
  let pathname = "";
  try {
    pathname = new URL(url).pathname || "";
  } catch {
    pathname = "";
  }

  const doc = await prisma.coachDocument.create({
    data: {
      user_id: me.id,
      kind: kind as any,
      title,
      url,
      pathname,
      mime_type: "application/octet-stream",
      size_bytes: 0,
      status: "pending",
    },
  });

  return NextResponse.json({ ok: true, document: doc }, { status: 200 });
}
