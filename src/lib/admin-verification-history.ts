// src/lib/admin-verification-history.ts — historique métier depuis audit_logs (approve/reject uniquement)
import { prisma } from "@/lib/db";

export type VerificationHistoryItemDto = {
  action: "approve" | "reject";
  actorId: string | null;
  actorEmail: string | null;
  createdAt: string;
  reason: string | null;
  statusAfter: "verified" | "rejected";
};

const APPROVE_ACTION = "admin.verification.approve";
const REJECT_ACTION = "admin.verification.reject";

/**
 * Événements métier uniquement (pas *_not_found / *_invalid_state / *_error).
 */
export async function buildVerificationHistoryItems(docId: string): Promise<VerificationHistoryItemDto[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      action: { in: [APPROVE_ACTION, REJECT_ACTION] },
      meta: {
        path: ["docId"],
        equals: docId,
      },
    },
    orderBy: { created_at: "desc" },
    include: { user: { select: { email: true } } },
  });

  const out: VerificationHistoryItemDto[] = [];

  for (const row of rows) {
    const m = (row.meta ?? {}) as Record<string, unknown>;

    const action: "approve" | "reject" =
      row.action === APPROVE_ACTION ? "approve" : "reject";
    const statusAfter: "verified" | "rejected" =
      row.action === APPROVE_ACTION ? "verified" : "rejected";

    let reason: string | null = typeof m.reason === "string" ? m.reason : null;
    if (!reason && typeof m.review_note === "string") reason = m.review_note;

    out.push({
      action,
      actorId: row.user_id ?? null,
      actorEmail: row.user?.email ?? null,
      createdAt: row.created_at.toISOString(),
      reason,
      statusAfter,
    });
  }

  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return out;
}
