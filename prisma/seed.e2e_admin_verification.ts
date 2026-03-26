/**
 * Coach + CoachDocument déterministes pour E2E `/admin/verification` → `/admin/users/[id]`.
 * Même garde que la pagination admin : `E2E_SEED_ADMIN_USERS_PAGINATION=1`.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const E2E_VERIFICATION_COACH_EMAIL = "e2e-verification-coach@exodus-e2e.local"
export const E2E_VERIFICATION_COACH_SLUG = "e2e-verification-coach"

export const E2E_VERIFICATION_REJECT_COACH_EMAIL = "e2e-verification-coach-reject@exodus-e2e.local"
export const E2E_VERIFICATION_REJECT_COACH_SLUG = "e2e-verification-coach-reject"

/** UUID fixes pour upsert idempotent (E2E approve / reject). */
export const E2E_VERIFICATION_DOCUMENT_ID_APPROVE = "a1111111-1111-4111-8111-111111111111"
export const E2E_VERIFICATION_DOCUMENT_ID_REJECT = "a2222222-2222-4222-8222-222222222222"

export async function seedE2eAdminVerificationCoachDoc() {
  if (process.env.E2E_SEED_ADMIN_USERS_PAGINATION !== "1") {
    console.log(
      "[seed] skip e2e admin verification coach doc (E2E_SEED_ADMIN_USERS_PAGINATION!=1)",
    )
    return
  }

  const user = await prisma.user.upsert({
    where: { email: E2E_VERIFICATION_COACH_EMAIL },
    create: {
      email: E2E_VERIFICATION_COACH_EMAIL,
      role: "coach",
      status: "active",
      onboardingStep: 3,
      name: "E2E Verification Coach",
    },
    update: {
      role: "coach",
      status: "active",
      onboardingStep: 3,
      name: "E2E Verification Coach",
    },
  })

  await prisma.coach.upsert({
    where: { user_id: user.id },
    create: {
      user_id: user.id,
      slug: E2E_VERIFICATION_COACH_SLUG,
      name: "E2E Verification Coach",
    },
    update: {
      slug: E2E_VERIFICATION_COACH_SLUG,
      name: "E2E Verification Coach",
    },
  })

  await prisma.coachDocument.upsert({
    where: { id: E2E_VERIFICATION_DOCUMENT_ID_APPROVE },
    create: {
      id: E2E_VERIFICATION_DOCUMENT_ID_APPROVE,
      user_id: user.id,
      kind: "diploma",
      title: "E2E verification doc (approve)",
      url: "https://exodus-e2e.local/verification/e2e-doc.pdf",
      pathname: "/verification/e2e-doc.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
      status: "pending",
    },
    update: {
      user_id: user.id,
      kind: "diploma",
      title: "E2E verification doc (approve)",
      url: "https://exodus-e2e.local/verification/e2e-doc.pdf",
      pathname: "/verification/e2e-doc.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
      status: "pending",
    },
  })

  const userReject = await prisma.user.upsert({
    where: { email: E2E_VERIFICATION_REJECT_COACH_EMAIL },
    create: {
      email: E2E_VERIFICATION_REJECT_COACH_EMAIL,
      role: "coach",
      status: "active",
      onboardingStep: 3,
      name: "E2E Verification Coach Reject",
    },
    update: {
      role: "coach",
      status: "active",
      onboardingStep: 3,
      name: "E2E Verification Coach Reject",
    },
  })

  await prisma.coach.upsert({
    where: { user_id: userReject.id },
    create: {
      user_id: userReject.id,
      slug: E2E_VERIFICATION_REJECT_COACH_SLUG,
      name: "E2E Verification Coach Reject",
    },
    update: {
      slug: E2E_VERIFICATION_REJECT_COACH_SLUG,
      name: "E2E Verification Coach Reject",
    },
  })

  await prisma.coachDocument.upsert({
    where: { id: E2E_VERIFICATION_DOCUMENT_ID_REJECT },
    create: {
      id: E2E_VERIFICATION_DOCUMENT_ID_REJECT,
      user_id: userReject.id,
      kind: "certification",
      title: "E2E verification doc (reject)",
      url: "https://exodus-e2e.local/verification/e2e-doc-reject.pdf",
      pathname: "/verification/e2e-doc-reject.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048,
      status: "pending",
    },
    update: {
      user_id: userReject.id,
      kind: "certification",
      title: "E2E verification doc (reject)",
      url: "https://exodus-e2e.local/verification/e2e-doc-reject.pdf",
      pathname: "/verification/e2e-doc-reject.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048,
      status: "pending",
    },
  })

  console.log("✅ e2e admin verification coach docs seeded (approve + reject)")
}

export async function runSeedE2eAdminVerificationCoachDoc() {
  try {
    await seedE2eAdminVerificationCoachDoc()
  } finally {
    await prisma.$disconnect()
  }
}
