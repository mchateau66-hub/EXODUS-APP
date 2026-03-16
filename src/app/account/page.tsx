import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import AccountSubscriptionSection from './AccountSubscriptionSection'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function InfoCard({
  title,
  description,
  href,
  cta,
}: {
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>

        <div>
          <Link
            href={href}
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function AccountPage() {
  const session = await getUserFromSession()
  if (!session) redirect('/login?next=/account')

  const userId = session.user?.id
  if (!userId) redirect('/login?next=/account')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      onboardingStep: true,
      name: true,
      email: true,
      bio: true,
      country: true,
      language: true,
      theme: true,
      keywords: true,
    },
  })

  if (!user) redirect('/login?next=/account')

  const onboardingStep = user.onboardingStep ?? 0

  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

  const role = user.role
  const isCoach = role === 'coach'
  const isAthlete = role === 'athlete'

  const name = user.name ?? ''
  const email = user.email ?? ''
  const bio = user.bio ?? ''
  const country = user.country ?? ''
  const language = user.language ?? 'fr'
  const theme = user.theme ?? 'system'
  const keywords = Array.isArray(user.keywords) ? user.keywords : []

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {isCoach ? 'Coach' : isAthlete ? 'Athlète' : 'Admin'}
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Bonjour {name || 'à toi'}
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Bienvenue dans ton espace compte. Tu peux gérer ici ton profil, ta sécurité,
              tes préférences et ton abonnement.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/hub"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400"
            >
              Aller au hub
            </Link>

            <Link
              href="/messages"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400"
            >
              Ouvrir les messages
            </Link>

            <Link
              href="/account/edit"
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
            >
              Modifier mon profil
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Aperçu du profil</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Les principales informations visibles ou utilisées dans l’application.
                </p>
              </div>

              <Link
                href="/account/profile"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Voir la section profil
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-800">Identité</h3>
                <div className="space-y-1 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{name || 'Nom non renseigné'}</p>
                  <p className="text-xs text-slate-500">{email || 'Email non renseigné'}</p>
                  <p className="text-[11px] text-slate-400">
                    Rôle : {isCoach ? 'Coach' : isAthlete ? 'Athlète' : 'Admin'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-800">Préférences actuelles</h3>
                <ul className="space-y-1 text-sm text-slate-700">
                  <li>
                    <span className="text-xs text-slate-500">Pays :</span> {country || 'Non renseigné'}
                  </li>
                  <li>
                    <span className="text-xs text-slate-500">Langue :</span>{' '}
                    {String(language).toUpperCase()}
                  </li>
                  <li>
                    <span className="text-xs text-slate-500">Thème :</span>{' '}
                    {theme === 'dark'
                      ? 'Fond sombre'
                      : theme === 'light'
                        ? 'Fond clair'
                        : 'Système'}
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-800">Mots-clés</h3>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.length > 0 ? (
                    keywords.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Aucun mot-clé ajouté pour le moment.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Bio</h3>
              {bio ? (
                <p className="whitespace-pre-line text-sm text-slate-700">{bio}</p>
              ) : (
                <p className="text-xs text-slate-400">Aucune bio renseignée pour le moment.</p>
              )}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <InfoCard
              title="Profil"
              description="Modifie tes informations publiques, tes détails personnels et la présentation de ton compte."
              href="/account/profile"
              cta="Gérer mon profil"
            />

            <InfoCard
              title="Sécurité"
              description="Retrouve bientôt les options liées au mot de passe, à la protection du compte et à la confidentialité."
              href="/account/security"
              cta="Ouvrir la sécurité"
            />

            <InfoCard
              title="Préférences"
              description="Centralise le thème, la langue et les réglages utiles à la navigation et à l’expérience."
              href="/account/preferences"
              cta="Voir mes préférences"
            />

            <InfoCard
              title="Abonnement"
              description="Consulte ton plan, ton statut premium et les actions liées à ta facturation."
              href="/account/billing"
              cta="Voir l’abonnement"
            />
          </section>
        </div>

        <div className="space-y-6">
          <Suspense fallback={null}>
            <AccountSubscriptionSection role={role} />
          </Suspense>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Raccourcis utiles</h2>
            <p className="mt-1 text-sm text-slate-500">
              Accès rapides vers les zones les plus utilisées de l’application.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/hub"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Hub
              </Link>

              <Link
                href="/messages"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Messages
              </Link>

              {isCoach ? (
                <Link
                  href="/coach"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
                >
                  Dashboard coach
                </Link>
              ) : (
                <Link
                  href="/coachs"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
                >
                  Trouver un coach
                </Link>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Vérification</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gère ton statut de vérification et complète les étapes utiles pour renforcer la confiance.
            </p>

            <div className="mt-4">
              <Link
                href="/account/verification"
                className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
              >
                Ouvrir la vérification
              </Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}