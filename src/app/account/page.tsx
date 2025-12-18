// src/app/account/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import AccountSubscriptionSection from './AccountSubscriptionSection'
import { Suspense } from "react";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AccountPage() {
  const session = await getUserFromSession()
  if (!session) {
    // On garde /hub comme destination unique post-login
    redirect('/login?next=/hub')
  }

  const sessionUser = (session as any).user
  const userId = sessionUser?.id
  if (!userId) redirect('/login?next=/hub')

  // ✅ DB source of truth
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) redirect('/login?next=/hub')

  const u = user as any
  const role = (u.role ?? 'athlete') as 'athlete' | 'coach' | 'admin'
  const onboardingStep = Number(u.onboardingStep ?? u.onboarding_step ?? 0)

  // ✅ Gating onboarding (règle actée)
  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

  const name = u.name ?? ''
  const email = (u.email ?? '') as string
  const bio = u.bio ?? ''
  const country = u.country ?? ''
  const language = (u.language ?? 'fr') as string
  const theme = (u.theme ?? 'system') as string
  const keywords = (Array.isArray(u.keywords) ? u.keywords : []) as string[]

  const isCoach = role === 'coach'
  const isAthlete = role === 'athlete'

  // Navigation “métier” : hub reste la home
  const primaryHome = '/hub'

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Topbar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Mon compte</span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {isCoach ? 'Coach' : isAthlete ? 'Athlète' : 'Admin'}
            </span>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href={primaryHome}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
            >
              Hub
            </Link>

            <Link
              href="/messages"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
            >
              Chat
            </Link>

            {isCoach ? (
              <Link
                href="/coach"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
              >
                Dashboard coach
              </Link>
            ) : (
              <Link
                href="/coachs"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
              >
                Trouver un coach
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {/* Section Profil principal */}
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Profil public</h1>
              <p className="text-xs text-slate-500">
                Ces informations sont visibles par les autres utilisateurs (coach ou athlètes).
              </p>
            </div>

            {/* ⚠️ IMPORTANT: /onboarding/step-3 redirect /hub si step>=3.
                Donc on pointe vers une future page d’édition post-onboarding.
                (Step suivant : je te file /account/edit). */}
            <Link
              href="/account/edit"
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              Modifier mon profil
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-3">
            {/* Identité */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">Identité</h2>
              <div className="space-y-1 text-sm">
                <p className="text-slate-900">{name || 'Nom non renseigné'}</p>
                <p className="text-xs text-slate-500">{email}</p>
                <p className="text-[11px] text-slate-400">
                  Rôle : {isCoach ? 'Coach' : isAthlete ? 'Athlète' : 'Admin'}
                </p>
              </div>
            </div>

            {/* Contexte */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">Contexte</h2>
              <ul className="space-y-1 text-sm text-slate-700">
                <li>
                  <span className="text-xs text-slate-500">Pays :</span> {country || 'Non renseigné'}
                </li>
                <li>
                  <span className="text-xs text-slate-500">Langue :</span> {String(language).toUpperCase()}
                </li>
                <li>
                  <span className="text-xs text-slate-500">Thème :</span>{' '}
                  {theme === 'dark' ? 'Fond sombre' : theme === 'light' ? 'Fond clair' : 'System'}
                </li>
              </ul>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">Mots-clés</h2>
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

          {/* Bio */}
          <div className="mt-2 border-t border-slate-100 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Bio</h2>
            {bio ? (
              <p className="whitespace-pre-line text-sm text-slate-700">{bio}</p>
            ) : (
              <p className="text-xs text-slate-400">Aucune bio renseignée pour le moment.</p>
            )}
          </div>
        </section>

        {/* Section Abonnement / entitlements (client) */}
      <Suspense fallback={null}>
         <AccountSubscriptionSection role={role} />
      </Suspense>


        {/* Section Statistiques (placeholder) */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Statistiques (bientôt)</h2>
            <span className="text-[11px] uppercase tracking-wide text-slate-400">À venir</span>
          </div>
          <p className="text-xs text-slate-500">
            Ici, on affichera tes statistiques : nombre de messages, nombre d’athlètes suivis, rétention, note moyenne,
            classement, etc.
          </p>
        </section>

        {/* Section Dossier & Réglages (placeholder) */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Dossier & CV (bientôt)</h2>
            <p className="text-xs text-slate-500">
              Pour les coachs : diplômes, certifications, documents vérifiés. Pour les athlètes : historique d’objectifs,
              plans suivis, etc.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Réglages, CGU/CGV & facturation (bientôt)</h2>
            <p className="text-xs text-slate-500">
              Ici tu retrouveras la gestion de ton abonnement, ton historique de factures, les CGU/CGV, les options
              avancées et le support.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
