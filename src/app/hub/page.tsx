// src/app/hub/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

import HubMapClient from './ui/HubMapClient'
import MyAdsClient from './ui/MyAdsClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function Card({
  title,
  desc,
  children,
}: {
  title: ReactNode
  desc?: string
  children: ReactNode
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

function ActionLink({
  href,
  label,
  variant = 'default',
}: {
  href: string
  label: string
  variant?: 'default' | 'primary'
}) {
  const base =
    'inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm transition'

  const cls =
    variant === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : 'border hover:bg-slate-50'

  return (
    <Link href={href} className={`${base} ${cls}`}>
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

type CoachVerifyStatus = 'missing' | 'pending' | 'needs_review' | 'verified'

function computeCoachVerification(statuses: string[]): {
  status: CoachVerifyStatus
  label: string
  className: string
  hint: string
} {
  if (!statuses || statuses.length === 0) {
    return {
      status: 'missing',
      label: 'Aucun doc',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
      hint: 'Ajoute tes diplômes/certifs pour lancer la vérification.',
    }
  }

  const hasNeedsReview = statuses.includes('needs_review')
  const hasRejected = statuses.includes('rejected')
  const hasPending = statuses.includes('pending')
  const allVerified = statuses.every((s) => s === 'verified')

  if (hasNeedsReview || hasRejected) {
    return {
      status: 'needs_review',
      label: 'À revoir',
      className: 'bg-amber-100 text-amber-900 border-amber-200',
      hint: 'Un document nécessite une action ou une vérification manuelle.',
    }
  }

  if (hasPending) {
    return {
      status: 'pending',
      label: 'En attente',
      className: 'bg-sky-100 text-sky-900 border-sky-200',
      hint: 'Tes documents sont en cours de vérification.',
    }
  }

  if (allVerified) {
    return {
      status: 'verified',
      label: 'Vérifié',
      className: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      hint: 'Tes documents sont validés ✅',
    }
  }

  return {
    status: 'pending',
    label: 'En attente',
    className: 'bg-sky-100 text-sky-900 border-sky-200',
    hint: 'Statut en cours.',
  }
}

function normalizeCountry(v: any) {
  const s = String(v ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(s) ? s : 'FR'
}

function normalizeLanguage(v: any) {
  const s = String(v ?? '').trim().toLowerCase()
  return s ? s : 'fr'
}

export default async function HubPage() {
  const session = await getUserFromSession()
  if (!session) redirect('/login?next=/hub')

  const userId =
    (session as any)?.user?.id ??
    (session as any)?.userId ??
    (session as any)?.id ??
    (session as any)?.user?.userId

  if (!userId) redirect('/login?next=/hub')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      onboardingStep: true,
      country: true,
      language: true,
    },
  })
  if (!user) redirect('/login?next=/hub')

  const onboardingStep = user.onboardingStep ?? 0
  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

  const role = String(user.role).toLowerCase()
  const isAthlete = role === 'athlete'
  const isCoach = role === 'coach'

  let coachVerify: ReturnType<typeof computeCoachVerification> | null = null
  const coachDocsCounts = {
    total: 0,
    pending: 0,
    verified: 0,
    needs_review: 0,
    rejected: 0,
  }

  if (isCoach) {
    const docs = await prisma.coachDocument.findMany({
      where: { user_id: user.id },
      select: { status: true },
    })

    const statuses = docs.map((d) => String(d.status))
    coachVerify = computeCoachVerification(statuses)

    coachDocsCounts.total = statuses.length
    for (const s of statuses) {
      if (s === 'pending') coachDocsCounts.pending += 1
      else if (s === 'verified') coachDocsCounts.verified += 1
      else if (s === 'needs_review') coachDocsCounts.needs_review += 1
      else if (s === 'rejected') coachDocsCounts.rejected += 1
    }
  }

  const roleLabel = isCoach ? 'Coach' : isAthlete ? 'Athlète' : 'Admin'
  const displayName = user.name?.trim() || user.email?.split('@')?.[0] || 'Mon compte'

  const verificationHref = isCoach
    ? '/account/verification/coach'
    : '/account/verification/athlete'

  const defaultCountry = normalizeCountry(user.country)
  const defaultLanguage = normalizeLanguage(user.language)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <header className="rounded-2xl border bg-gradient-to-br from-slate-50 to-white p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-600">Hub central — Espace {roleLabel}</p>
            <h1 className="text-2xl font-semibold">Bonjour, {displayName}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Ici tu navigues vers la map, la messagerie, ton profil, et tes offres.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionLink href="/messages" label="Messages" />
            <ActionLink href="/account" label="Mon profil" />
            {isCoach ? (
              <ActionLink href="/coach" label="Dashboard coach" />
            ) : (
              <ActionLink
                href={`/coachs?country=${encodeURIComponent(defaultCountry)}&language=${encodeURIComponent(
                  defaultLanguage
                )}`}
                label="Vue liste (coachs)"
              />
            )}
            <ActionLink href="/paywall" label="Offres" />
          </div>
        </div>
      </header>

      {/* MAP HUB (MVP) */}
      <section className="rounded-3xl border bg-slate-950 p-4 text-white shadow-sm">
        <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              Hub Map
            </p>
            <h2 className="text-lg font-semibold">
              {isAthlete ? 'Carte des coachs' : isCoach ? 'Carte des annonces athlètes' : 'Carte'}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              Par défaut : pays = <span className="font-semibold">{defaultCountry}</span>
              {' • '}
              langue = <span className="font-semibold">{defaultLanguage.toUpperCase()}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAthlete ? (
              <Link
                href={`/coachs?country=${encodeURIComponent(defaultCountry)}&language=${encodeURIComponent(
                  defaultLanguage
                )}`}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Ouvrir la liste filtrée
              </Link>
            ) : null}
          </div>
        </div>

        <HubMapClient role={role} defaultCountry={defaultCountry} defaultLanguage={defaultLanguage} />
      </section>

      {/* Grid / cards métiers */}
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
              title={
                <div className="flex items-center gap-2">
                  <span>Profil & vérification</span>

                  {coachVerify ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${coachVerify.className}`}
                    >
                      {coachVerify.label}
                    </span>
                  ) : null}
                </div>
              }
              desc={
                coachVerify?.hint ??
                'Upload photo + diplômes/certifs + statut (pending/verified/needs_review).'
              }
            >
              <div className="mb-3 text-xs text-slate-600">
                {coachDocsCounts.total === 0
                  ? '0 document'
                  : `${coachDocsCounts.total} doc • ${coachDocsCounts.verified} vérifié(s) • ${coachDocsCounts.pending} en attente • ${
                      coachDocsCounts.needs_review + coachDocsCounts.rejected
                    } à revoir`}
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionLink href="/account" label="Voir mon profil" />
                <ActionLink href="/account/edit" label="Modifier mon profil" />
                <ActionLink
                  href={verificationHref}
                  label={
                    coachVerify?.status === 'missing'
                      ? 'Ajouter mes documents'
                      : coachVerify?.status === 'needs_review'
                      ? 'Corriger mes documents'
                      : 'Vérification (docs)'
                  }
                  variant={
                    coachVerify?.status === 'missing' || coachVerify?.status === 'needs_review'
                      ? 'primary'
                      : 'default'
                  }
                />
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
                <ActionLink
                  href={`/coachs?country=${encodeURIComponent(defaultCountry)}&language=${encodeURIComponent(
                    defaultLanguage
                  )}`}
                  label="Rechercher des coachs"
                  variant="primary"
                />
                <ActionLink href="/messages" label="Mes conversations" />
                <ActionLink href="/ads/new" label="Créer une annonce" variant="primary" />
              </div>
            </Card>

            <Card title="Votre profil" desc="Accédez à votre compte (profil, abonnement, etc.).">
              <div className="flex flex-wrap gap-2">
                <ActionLink href="/account" label="Voir mon profil" />
                <ActionLink href="/account/edit" label="Modifier mon profil" />
                <ActionLink href="/paywall" label="Voir les offres" />
                <ActionLink href={verificationHref} label="Vérification" />
              </div>
            </Card>
          </>
        )}
      </section>

      {/* ✅ Mes annonces (ATHLETE ONLY) */}
      {isAthlete ? <MyAdsClient /> : null}

      {/* Footer hint */}
      <section className="rounded-2xl border bg-white p-4 text-sm text-slate-600">
        <p>
          ✅ <strong>/hub</strong> reste la destination unique post-login et post-onboarding.
        </p>
      </section>
    </main>
  )
}
