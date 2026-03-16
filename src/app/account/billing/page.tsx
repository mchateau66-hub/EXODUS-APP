import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import AccountSubscriptionSection from '../AccountSubscriptionSection'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function BillingInfoCard({
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

export default async function AccountBillingPage() {
  const session = await getUserFromSession()
  if (!session) redirect('/login?next=/account/billing')

  const userId = session.user?.id
  if (!userId) redirect('/login?next=/account/billing')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingStep: true,
      role: true,
      stripe_customer_id: true,
    },
  })

  if (!user) redirect('/login?next=/account/billing')

  const onboardingStep = user.onboardingStep ?? 0

  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Paramètres · Abonnement
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Mon abonnement
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Consulte ici ton plan actuel, ton statut premium et les prochaines
            options liées à la facturation.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Suspense fallback={null}>
            <AccountSubscriptionSection role={user.role} />
          </Suspense>

          <BillingInfoCard
            title="Facturation"
            description="Les prochaines options liées au paiement et au suivi de l’abonnement seront regroupées ici."
          >
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                À venir : portail de facturation Stripe, historique des paiements,
                factures, annulation et reprise d’abonnement.
              </p>
            </div>
          </BillingInfoCard>

          <BillingInfoCard
            title="Compte Stripe"
            description="État actuel du rattachement client pour la facturation."
          >
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">
                Stripe customer
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900 break-all">
                {user.stripe_customer_id || 'Aucun customer Stripe encore créé'}
              </div>
            </div>
          </BillingInfoCard>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Ce qui arrive ensuite</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cette section est prête à accueillir les prochaines briques de monétisation.
            </p>

            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="rounded-2xl bg-slate-50 p-4">
                Portail client Stripe pour gérer les moyens de paiement et les factures.
              </li>
              <li className="rounded-2xl bg-slate-50 p-4">
                Affichage du renouvellement, du statut et de l’historique d’abonnement.
              </li>
              <li className="rounded-2xl bg-slate-50 p-4">
                Upgrade, downgrade et résiliation depuis l’espace compte.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Navigation rapide</h2>
            <p className="mt-1 text-sm text-slate-500">
              Reviens facilement aux autres sections de ton compte.
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
                href="/account/preferences"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400"
              >
                Préférences
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}