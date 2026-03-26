import { NextRequest } from "next/server";
import { postVerificationModeration } from "@/lib/admin-verification-moderation";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const p = await Promise.resolve(params);
  const id = String(p?.id || "").trim();
  return postVerificationModeration(req, id, "reject");
}
