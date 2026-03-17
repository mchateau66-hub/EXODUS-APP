import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function PreferenceCard({
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

export default async function AccountPreferencesPage() {
  const session = await getUserFromSession()
  if (!session) redirect('/login?next=/account/preferences')

  const userId = session.user?.id
  if (!userId) redirect('/login?next=/account/preferences')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingStep: true,
      language: true,
      theme: true,
      country: true,
      role: true,
    },
  })

  if (!user) redirect('/login?next=/account/preferences')

  const onboardingStep = user.onboardingStep ?? 0

  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

  const themeLabel =
    user.theme === 'dark'
      ? 'Fond sombre'
      : user.theme === 'light'
        ? 'Fond clair'
        : 'Système'

  const languageLabel = String(user.language ?? 'fr').toUpperCase()
  const countryLabel = user.country || 'Non renseigné'
  const roleLabel =
    user.role === 'coach'
      ? 'Coach'
      : user.role === 'athlete'
        ? 'Athlète'
        : 'Admin'

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Paramètres · Préférences
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Préférences de l’application
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Retrouve ici les réglages qui influencent ton confort, la navigation
            et l’expérience générale dans l’application.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <PreferenceCard
            title="Préférences actuelles"
            description="État actuel des réglages principaux déjà connus par ton compte."
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-medium text-slate-500">Thème</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {themeLabel}
                </dd>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-medium text-slate-500">Langue</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {languageLabel}
                </dd>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-medium text-slate-500">Pays</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {countryLabel}
                </dd>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-medium text-slate-500">Type de compte</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {roleLabel}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <Link
                href="/account/profile"
                className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
              >
                Modifier mes réglages actuels
              </Link>
            </div>
          </PreferenceCard>

          <PreferenceCard
            title="Affichage et confort"
            description="Cette zone accueillera les prochains réglages d’interface et d’expérience."
          >
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                À venir : densité d’affichage, préférences map/liste, options
                d’ergonomie, réglages visuels et comportement de navigation.
              </p>
            </div>
          </PreferenceCard>

          <PreferenceCard
            title="Notifications et communication"
            description="Les choix liés aux emails, alertes et messages seront centralisés ici."
          >
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                À venir : notifications email, alertes de messages, réponses,
                mises à jour de compte et événements importants.
              </p>
            </div>
          </PreferenceCard>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Conseils d’usage</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quelques réglages influencent directement le confort dans l’app.
            </p>

            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="rounded-2xl bg-slate-50 p-4">
                Choisis un thème cohérent avec ton environnement pour améliorer la lisibilité.
              </li>
              <li className="rounded-2xl bg-slate-50 p-4">
                Garde une langue claire et homogène pour éviter les incohérences d’interface.
              </li>
              <li className="rounded-2xl bg-slate-50 p-4">
                Mets à jour régulièrement ton profil pour que l’expérience reste pertinente.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Navigation rapide</h2>
            <p className="mt-1 text-sm text-slate-500">
              Accède rapidement aux autres zones de ton espace compte.
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
                href="/account/security"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Sécurité
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