import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getUserFromSession();
  if (!ctx) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { id: true, role: true } });
  if (!me) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });

  if (String(me.role).toLowerCase() !== "coach") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const doc = await prisma.coachDocument.findUnique({ where: { id: params.id } });
  if (!doc || doc.user_id !== me.id) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  await prisma.coachDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true }, { status: 200 });
}
