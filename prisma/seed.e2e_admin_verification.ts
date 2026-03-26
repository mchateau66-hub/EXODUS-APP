/**
 * Coach + CoachDocument déterministes pour E2E `/admin/verification` → `/admin/users/[id]`.
 * Même garde que la pagination admin : `E2E_SEED_ADMIN_USERS_PAGINATION=1`.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const E2E_VERIFICATION_COACH_EMAIL = "e2e-verification-coach@exodus-e2e.local"
export const E2E_VERIFICATION_COACH_SLUG = "e2e-verification-coach"

/** UUID fixe pour upsert idempotent (évite doublons si le seed est relancé). */
const E2E_VERIFICATION_DOCUMENT_ID = "a1111111-1111-4111-8111-111111111111"

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
    where: { id: E2E_VERIFICATION_DOCUMENT_ID },
    create: {
      id: E2E_VERIFICATION_DOCUMENT_ID,
      user_id: user.id,
      kind: "diploma",
      title: "E2E verification doc",
      url: "https://exodus-e2e.local/verification/e2e-doc.pdf",
      pathname: "/verification/e2e-doc.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
      status: "pending",
    },
    update: {
      user_id: user.id,
      kind: "diploma",
      title: "E2E verification doc",
      url: "https://exodus-e2e.local/verification/e2e-doc.pdf",
      pathname: "/verification/e2e-doc.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
      status: "pending",
    },
  })

  console.log("✅ e2e admin verification coach doc seeded")
}

export async function runSeedE2eAdminVerificationCoachDoc() {
  try {
    await seedE2eAdminVerificationCoachDoc()
  } finally {
    await prisma.$disconnect()
  }
}
