// src/app/onboarding/step-3/page.tsx
import { redirect } from "next/navigation"
import { getUserFromSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import OnboardingStep3Client from "../ui/OnboardingStep3Client"

export const runtime = "nodejs"

export default async function OnboardingStep3Page() {
  const session = await getUserFromSession()
  if (!session) {
    redirect("/login?next=/onboarding/step-3")
  }

  const userId = (session.user as any).id as string

  // ✅ Source de vérité: DB (évite session stale)
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingStep: true, role: true },
  })

  if (!dbUser) {
    redirect("/login?next=/onboarding/step-3")
  }

  const step = typeof dbUser.onboardingStep === "number" ? dbUser.onboardingStep : 0
  const role = dbUser.role as "coach" | "athlete" | "admin"

  // 🟡 ordre des étapes
  if (step < 1) redirect("/onboarding")
  if (step < 2) redirect("/onboarding/step-2")

  // 🔒 onboarding terminé -> hub (destination unique)
  if (step >= 3) redirect("/hub")

  // sécurité role
  if (role !== "coach" && role !== "athlete") redirect("/hub")

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-3xl">
        <OnboardingStep3Client role={role} />
      </section>
    </main>
  )
}
