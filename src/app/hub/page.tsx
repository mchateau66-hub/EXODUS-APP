import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function Card({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {desc ? <p className="mt-1 text-sm text-slate-600">{desc}</p> : null}
      </div>
      {children}
    </section>
  )
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-sm hover:bg-slate-50"
    >
      {label}
    </Link>
  )
}

function DisabledAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl border px-3 py-2 text-sm opacity-50"
    >
      {label}
    </button>
  )
}

export default async function HubPage() {
  const ctx = await getUserFromSession()
  if (!ctx) redirect('/login?next=/hub')

  // DB source of truth
  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } })
  if (!user) redirect('/login?next=/hub')

  const u = user as any
  const onboardingStep = Number(u.onboardingStep ?? u.onboarding_step ?? 0)
  const role = String(u.role ?? '').toLowerCase() as 'coach' | 'athlete' | string
  const displayName = String(
    u.name ?? u.fullName ?? u.email?.split('@')?.[0] ?? 'Mon compte'
  )

  // Gating onboarding (décision actée)
  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

  const isCoach = role === 'coach'
  const roleLabel = isCoach ? 'Coach' : 'Athlète'

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <header className="rounded-2xl border bg-gradient-to-br from-slate-50 to-white p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-600">Espace {roleLabel}</p>
            <h1 className="text-2xl font-semibold">Bonjour, {displayName}</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionLink href="/messages" label="Messages" />
            <ActionLink href="/account" label="Mon profil" />
            {isCoach ? (
              <ActionLink href="/coach" label="Accéder à /coach" />
            ) : (
              <ActionLink href="/coachs" label="Trouver un coach" />
            )}
            <ActionLink href="/paywall" label="Offres" />
          </div>
        </div>
      </header>

      {/* Grid */}
      <section className="grid gap-4 md:grid-cols-2">
        {isCoach ? (
          <>
            <Card
              title="Votre activité"
              desc="Raccourcis vers les pages métier (dashboard coach, messages, etc.)."
            >
              <div className="flex flex-wrap gap-2">
                <ActionLink href="/coach" label="Dashboard coach" />
                <ActionLink href="/messages" label="Voir mes messages" />
                <DisabledAction label="Mes athlètes (bientôt)" />
              </div>
            </Card>

            <Card
  title="Profil & vérification"
  desc="Prochaine étape : upload photo + diplômes/certifs + statut (pending/verified/needs_review)."
>
  <div className="flex flex-wrap gap-2">
    <ActionLink href="/account" label="Voir mon profil" />
    <ActionLink href="/account/edit" label="Modifier mon profil" />
    <ActionLink href="/account/verification" label="Uploader diplômes/certifs" />
<ActionLink href="/account/verification" label="Voir mon statut" />
  </div>
</Card>
 
          </>
        ) : (
          <>
            <Card
              title="Trouver le bon coach"
              desc="Accédez à la recherche et commencez à contacter des coachs."
            >
              <div className="flex flex-wrap gap-2">
                <ActionLink href="/coachs" label="Rechercher des coachs" />
                <ActionLink href="/messages" label="Mes conversations" />
              </div>
            </Card>

            <Card
              title="Votre profil"
              desc="Accédez à votre compte (profil, abonnement, etc.)."
            >
              <div className="flex flex-wrap gap-2">
                <ActionLink href="/account" label="Voir mon profil" />
                <ActionLink href="/paywall" label="Voir les offres" />
              </div>
            </Card>
          </>
        )}
      </section>

      {/* Footer hint */}
      <section className="rounded-2xl border bg-white p-4 text-sm text-slate-600">
        <p>
          ✅ On garde <strong>/hub</strong> comme destination unique post-login et
          post-onboarding. Étape suivante : rendre “Modifier mon profil” réel +
          clarifier la navigation finale.
        </p>
      </section>
    </main>
  )
}
