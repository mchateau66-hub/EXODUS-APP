// src/app/page.tsx
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'

const LOGO_SRC = '/logo.svg' // mets ton logo dans /public/logo.svg (ou change ce chemin)

export default async function HomePage() {
  const ctx = await getUserFromSession()

  // Si déjà connecté → hub central (redirige ensuite selon rôle/onboarding)
  if (ctx?.user) redirect('/hub')

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      {/* Fond (dégradés) */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_30%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(900px_500px_at_20%_80%,rgba(168,85,247,0.14),transparent_60%)]" />

      {/* Logo géant en fond (décoratif) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[70vmin] w-[70vmin] opacity-[0.08] blur-[0.2px]">
          <Image
            src={LOGO_SRC}
            alt=""
            aria-hidden="true"
            fill
            priority
            className="object-contain"
            sizes="70vmin"
          />
        </div>
      </div>

      {/* Overlay contraste (pour lisibilité du texte) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />

      {/* Contenu */}
      <div className="relative mx-auto flex min-h-[100dvh] max-w-5xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10">
              <Image
                src={LOGO_SRC}
                alt="Rencontre Coach"
                fill
                className="object-contain"
                sizes="40px"
                priority
              />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Rencontre Coach</h1>
              <p className="mt-1 text-sm text-white/70">
                Trouve ton coach, échange, progresse.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/login?next=/hub"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-white text-slate-950 font-semibold shadow-sm transition hover:bg-white/90"
            >
              Se connecter
            </Link>

            <Link
              href="/signup?next=/hub"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/20 bg-transparent font-semibold text-white transition hover:bg-white/10"
            >
              S’inscrire
            </Link>
          </div>

          <p className="mt-4 text-xs text-white/55">
            Déjà un compte ? Connexion immédiate vers le hub central.
          </p>
        </div>
      </div>
    </main>
  )
}
