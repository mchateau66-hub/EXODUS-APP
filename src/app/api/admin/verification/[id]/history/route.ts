import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { canModerateVerification } from "@/lib/admin-verification-moderation";
import { buildVerificationHistoryItems } from "@/lib/admin-verification-history";
import { limit, rateHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";

function setRateHeaders(res: NextResponse, rl: ReturnType<typeof rateHeaders>) {
  rl.forEach((v, k) => res.headers.set(k, v));
  return res;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  if (process.env.FEATURE_ADMIN_DASHBOARD === "0") {
    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  }

  const p = await Promise.resolve(params);
  const docId = String(p?.id || "").trim();
  if (!docId) {
    return NextResponse.json({ success: false, error: "missing_id" }, { status: 400 });
  }

  const rawSession: unknown = await getUserFromSession();
  const user = (rawSession as any)?.user;

  if (!user?.id) {
    return NextResponse.json({ success: false, error: "invalid_session" }, { status: 401 });
  }
  if (!canModerateVerification(user)) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const limitN = parseInt(process.env.RATELIMIT_ADMIN_LIMIT || "60", 10);
  const windowS = parseInt(process.env.RATELIMIT_ADMIN_WINDOW_S || "300", 10);
  const rl = await limit("admin", user.id, limitN, windowS * 1000);
  const rlH = rateHeaders(rl);

  if (!rl.ok) {
    const res = NextResponse.json({ success: false, error: "rate_limited" }, { status: 429 });
    return setRateHeaders(res, rlH);
  }

  const doc = await prisma.coachDocument.findUnique({
    where: { id: docId },
    select: { id: true },
  });
  if (!doc) {
    const res = NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
    return setRateHeaders(res, rlH);
  }

  const items = await buildVerificationHistoryItems(docId);
  const res = NextResponse.json({ success: true, items }, { status: 200 });
  return setRateHeaders(res, rlH);
}
