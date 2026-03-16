import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function NotificationCard({
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

function NotificationRow({
  label,
  description,
}: {
  label: string
  description: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 p-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="mt-1 text-sm text-slate-600">{description}</div>
      </div>

      <div className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
        Bientôt configurable
      </div>
    </div>
  )
}

export default async function AccountNotificationsPage() {
  const session = await getUserFromSession()
  if (!session) redirect('/login?next=/account/notifications')

  const userId = session.user?.id
  if (!userId) redirect('/login?next=/account/notifications')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingStep: true,
      role: true,
      email: true,
    },
  })

  if (!user) redirect('/login?next=/account/notifications')

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
            Paramètres · Notifications
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Notifications et alertes
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Cette section regroupera les préférences liées aux emails, aux
            alertes produit et aux messages importants de l’application.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <NotificationCard
            title="Messages et activité"
            description="Préférences liées aux échanges et aux événements de ton activité."
          >
            <div className="space-y-3">
              <NotificationRow
                label="Nouveaux messages"
                description="Être averti lorsqu’un nouveau message arrive dans une conversation."
              />
              <NotificationRow
                label="Réponses reçues"
                description="Recevoir une alerte lorsqu’un coach ou un athlète répond."
              />
              <NotificationRow
                label="Nouveaux contacts"
                description="Être informé quand une nouvelle interaction importante démarre."
              />
            </div>
          </NotificationCard>

          <NotificationCard
            title="Compte et abonnement"
            description="Préférences liées à la sécurité et à la facturation."
          >
            <div className="space-y-3">
              <NotificationRow
                label="Paiements et abonnement"
                description="Recevoir les confirmations et changements liés au plan premium."
              />
              <NotificationRow
                label="Sécurité du compte"
                description="Être averti en cas d’action importante liée à l’accès au compte."
              />
              <NotificationRow
                label="Mises à jour importantes"
                description="Recevoir les informations essentielles sur l’évolution de ton compte."
              />
            </div>
          </NotificationCard>

          <NotificationCard
            title="Canaux de communication"
            description="Les canaux actifs et futurs seront centralisés ici."
          >
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                À venir : préférences email, notifications in-app, fréquence
                d’envoi, résumé d’activité et réglages par type d’alerte.
              </p>
            </div>
          </NotificationCard>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Résumé compte</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quelques informations utiles liées à la réception des notifications.
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
              Reviens facilement vers les autres sections du compte.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/account"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Vue d’ensemble
              </Link>
              <Link
                href="/account/preferences"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Préférences
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