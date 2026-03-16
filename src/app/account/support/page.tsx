import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function SupportCard({
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

function SupportLink({
  href,
  label,
  description,
}: {
  href: string
  label: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-400"
    >
      <div className="text-sm font-medium text-slate-900">{label}</div>
      <div className="mt-1 text-sm text-slate-600">{description}</div>
    </Link>
  )
}

export default async function AccountSupportPage() {
  const session = await getUserFromSession()
  if (!session) redirect('/login?next=/account/support')

  const userId = session.user?.id
  if (!userId) redirect('/login?next=/account/support')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingStep: true,
      email: true,
      role: true,
    },
  })

  if (!user) redirect('/login?next=/account/support')

  const onboardingStep = user.onboardingStep ?? 0

  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

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
            Paramètres · Support
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Aide, support et informations utiles
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Retrouve ici les points d’aide, les futurs liens légaux et les
            actions utiles si tu rencontres un problème dans l’application.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <SupportCard
            title="Aide rapide"
            description="Les principaux points d’entrée pour t’aider à utiliser l’application."
          >
            <div className="grid gap-3">
              <SupportLink
                href="/account"
                label="Gérer mon compte"
                description="Revenir à la vue d’ensemble du compte et aux paramètres principaux."
              />
              <SupportLink
                href="/account/profile"
                label="Mettre à jour mon profil"
                description="Modifier tes informations publiques et personnelles."
              />
              <SupportLink
                href="/account/security"
                label="Sécurité du compte"
                description="Accéder aux informations et actions liées à la protection du compte."
              />
              <SupportLink
                href="/account/billing"
                label="Abonnement et facturation"
                description="Consulter ton plan actuel et les informations liées au premium."
              />
            </div>
          </SupportCard>

          <SupportCard
            title="Signaler un problème"
            description="Zone prévue pour centraliser les demandes support et les bugs."
          >
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                À venir : formulaire de contact support, signalement de bug,
                remontée d’un problème de paiement ou d’un souci d’affichage.
              </p>
            </div>
          </SupportCard>

          <SupportCard
            title="Informations légales"
            description="Les documents et pages de référence de l’application seront accessibles ici."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">
                  Conditions générales
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  À brancher : CGU / CGV selon le périmètre final.
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">
                  Politique de confidentialité
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  À brancher : gestion des données, confidentialité et droits utilisateur.
                </p>
              </div>
            </div>
          </SupportCard>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Résumé compte</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quelques informations utiles pour contextualiser l’assistance.
            </p>

            <dl className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-medium text-slate-500">Email principal</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {user.email || 'Non renseigné'}
                </dd>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-medium text-slate-500">Type de compte</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {roleLabel}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Navigation rapide</h2>
            <p className="mt-1 text-sm text-slate-500">
              Reviens vers les autres zones importantes du compte.
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
                href="/account/preferences"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Préférences
              </Link>
              <Link
                href="/account/notifications"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Notifications
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}