import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function SecurityCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default async function AccountSecurityPage() {
  const session = await getUserFromSession()
  if (!session) redirect('/login?next=/account/security')

  const userId = session.user?.id
  if (!userId) redirect('/login?next=/account/security')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingStep: true,
      email: true,
      role: true,
      created_at: true,
    },
  })

  if (!user) redirect('/login?next=/account/security')

  const onboardingStep = user.onboardingStep ?? 0

  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Paramètres · Sécurité
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Sécurité du compte
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Gère ici les éléments liés à la protection de ton compte, à tes accès
            et aux prochaines options de confidentialité.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <SecurityCard
            title="Accès au compte"
            description="Informations de base sur la session et l’identité du compte."
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-medium text-slate-500">Email</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {user.email || 'Non renseigné'}
                </dd>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-medium text-slate-500">Rôle</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {user.role === 'coach'
                    ? 'Coach'
                    : user.role === 'athlete'
                      ? 'Athlète'
                      : 'Admin'}
                </dd>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Compte créé le</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Information indisponible'}
                </dd>
              </div>
            </dl>
          </SecurityCard>

          <SecurityCard
            title="Mot de passe"
            description="Le flux de réinitialisation est déjà disponible. Une vraie section de changement de mot de passe pourra être ajoutée ensuite."
          >
            <div className="flex flex-wrap gap-3">
              <Link
                href="/forgot-password"
                className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
              >
                Réinitialiser le mot de passe
              </Link>

              <Link
                href="/reset-password"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Ouvrir la page reset
              </Link>
            </div>
          </SecurityCard>

          <SecurityCard
            title="Sessions et appareils"
            description="Cette partie préparera l’affichage des sessions actives et la déconnexion globale."
          >
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                À venir : liste des sessions actives, historique récent et option
                “se déconnecter de tous les appareils”.
              </p>
            </div>
          </SecurityCard>

          <SecurityCard
            title="Confidentialité et contrôle du compte"
            description="Les actions sensibles seront centralisées ici."
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">
                  À venir : export des données, suppression du compte, options de
                  confidentialité et blocage d’utilisateurs.
                </p>
              </div>
            </div>
          </SecurityCard>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Bonnes pratiques</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quelques rappels utiles pour garder ton compte protégé.
            </p>

            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="rounded-2xl bg-slate-50 p-4">
                Utilise un mot de passe long, unique et difficile à réutiliser ailleurs.
              </li>
              <li className="rounded-2xl bg-slate-50 p-4">
                Évite de partager l’accès à ton compte, même temporairement.
              </li>
              <li className="rounded-2xl bg-slate-50 p-4">
                Vérifie régulièrement les informations de ton profil et tes accès.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Navigation rapide</h2>
            <p className="mt-1 text-sm text-slate-500">
              Reviens vite aux autres zones importantes de ton compte.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/account"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Vue d’ensemble
              </Link>
              <Link
                href="/account/profile"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Profil
              </Link>
              <Link
                href="/account/billing"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Abonnement
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}