// src/app/admin/verification/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOnboardingStep } from "@/lib/onboarding";
import AdminVerificationClient from "./ui/AdminVerificationClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type DocRow = {
  id: string;
  userId: string;
  coachSlug: string | null;
  coachName: string | null;

  kind: string;
  title: string | null;
  status: string;

  reviewNote: string | null;
  reviewedAt: string | null;
  reviewerId: string | null;
  reviewerEmail: string | null;

  createdAt: string;
  url: string;
};

export default async function AdminVerificationPage() {
  // Optionnel : feature flag
  if (process.env.FEATURE_ADMIN_DASHBOARD === "0") redirect("/hub");

  const session = await requireOnboardingStep(3);
  const user = session.user as any;

  if (user?.role !== "admin") redirect("/hub");

  const docs = await prisma.coachDocument.findMany({
    orderBy: { created_at: "desc" },
    take: 250,
    select: {
      id: true,
      user_id: true,
      kind: true,
      title: true,
      status: true,
      review_note: true,
      reviewed_at: true,
      reviewer_id: true,
      created_at: true,
      url: true,
      reviewer: {
        select: { email: true },
      },
    },
  });

  const userIds = Array.from(new Set(docs.map((d) => String(d.user_id))));

  const coaches = userIds.length
    ? await prisma.coach.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, slug: true, name: true },
      })
    : [];

  const coachByUserId = new Map<string, { slug: string | null; name: string | null }>();
  for (const c of coaches) {
    coachByUserId.set(String(c.user_id), { slug: c.slug ?? null, name: c.name ?? null });
  }

  const rows: DocRow[] = docs.map((d) => {
    const uid = String(d.user_id);
    const coach = coachByUserId.get(uid) ?? { slug: null, name: null };

    return {
      id: String(d.id),
      userId: uid,
      coachSlug: coach.slug,
      coachName: coach.name,

      kind: String(d.kind),
      title: d.title ? String(d.title) : null,
      status: String(d.status),

      reviewNote: d.review_note ? String(d.review_note) : null,
      reviewedAt: d.reviewed_at ? new Date(d.reviewed_at).toISOString() : null,
      reviewerId: d.reviewer_id ? String(d.reviewer_id) : null,
      reviewerEmail: d.reviewer?.email ? String(d.reviewer.email) : null,

      createdAt: new Date(d.created_at).toISOString(),
      url: String(d.url),
    };
  });

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Admin
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Vérification coachs
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Filtres + sélection + actions rapides + reviewer email.
            </p>
          </div>

          <a
            href="/hub"
            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Hub
          </a>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur">
          <AdminVerificationClient initialRows={rows} />
        </div>
      </div>
    </main>
  );
}
